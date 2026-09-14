import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { parseCorsOrigins, type Env } from "../../config/env";
import { UsersService } from "../users/users.service";

import type { TelegramMessage, TelegramUpdate } from "./telegram-update";

const SHARE_CONTACT_TEXT = "📱 Поделиться номером";
const START_TEXT = "🚀 Начать";

const WELCOME_TEXT =
  "Привет! Это Amola 💜\n\n" +
  "Ваши финансы — без таблиц и лишней рутины.\n\n" +
  "Добавляйте расходы голосом или вручную, следите за балансом и получайте понятную аналитику.\n\n" +
  "Скажите «Кофе 340 рублей» — Amola запишет всё сама 🎙\n\n" +
  "Меньше времени на учёт. Больше понимания своих денег.\n\n" +
  "Готовы начать?";

/**
 * The bot side of onboarding: a /start welcome, then a second message asking for the
 * phone number (Telegram's own "share contact" button — never a typed field, so the
 * number always comes from Telegram itself, not a spoofable text message), then a button
 * into the Mini App. Registration itself doesn't wait on any of this —
 * `findOrCreateByTelegramIdentity` runs the moment /start arrives, the same call the Mini
 * App's own silent login makes, so chatting with the bot first and opening the app first
 * land on the exact same account either way.
 */
@Injectable()
export class TelegramBotService {
  private readonly logger = new Logger(TelegramBotService.name);
  private readonly apiUrl: string;
  private readonly bannerUrl?: string;
  private readonly miniAppUrl?: string;

  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly users: UsersService,
  ) {
    this.apiUrl = `https://api.telegram.org/bot${config.get("TELEGRAM_BOT_TOKEN", { infer: true })}`;

    // Telegram caches a photo by its exact URL and never re-fetches it, so a replaced
    // banner file kept showing the old picture after a deploy. A per-boot query string
    // makes every restart a fresh URL for Telegram; the web container ignores it.
    const banner = config.get("TELEGRAM_BANNER_URL", { infer: true });
    this.bannerUrl = banner ? `${banner}${banner.includes("?") ? "&" : "?"}v=${Date.now()}` : undefined;

    const origins = parseCorsOrigins(config.get("CORS_ORIGIN", { infer: true }));
    this.miniAppUrl = Array.isArray(origins) ? origins[0] : undefined;
  }

  /** The only part of this the caller (the webhook controller) actually awaits is the
   * state change — `findOrCreateByTelegramIdentity` / `setPhoneForTelegramIdentity`.
   * Every reply to Telegram itself is fire-and-forget (`callApi` swallows its own
   * errors): Telegram wants a fast 200 ack, not a round trip through its own API, and a
   * slow or unreachable api.telegram.org must never turn into a slow or failed webhook
   * response — Telegram would just retry the same update. */
  async handleUpdate(update: TelegramUpdate): Promise<void> {
    const message = update.message;
    if (!message?.from) return;

    if (message.text === "/start") return this.handleStart(message);
    if (message.contact) return this.handleContact(message);
    // Anything else — no command grammar to teach; the share-number keyboard is still up.
  }

  private async handleStart(message: TelegramMessage): Promise<void> {
    const from = message.from;
    if (!from) return;
    await this.users.findOrCreateByTelegramIdentity({
      id: from.id,
      first_name: from.first_name,
      last_name: from.last_name,
      language_code: from.language_code,
    });

    const chatId = message.chat.id;
    const welcome = this.bannerUrl
      ? this.callApi("sendPhoto", { chat_id: chatId, photo: this.bannerUrl, caption: WELCOME_TEXT })
      : this.callApi("sendMessage", { chat_id: chatId, text: WELCOME_TEXT });

    // Chained, not parallel: two independent fetches could land in either order, and the
    // ask must come after the welcome. Still nothing here is awaited by the webhook.
    void welcome.then(() =>
      this.callApi("sendMessage", {
        chat_id: chatId,
        text:
          "Чтобы начать, поделитесь номером телефона.\n\n" +
          `<i>Продолжая, вы соглашаетесь с <a href="${this.legalUrl("terms")}">условиями использования</a> ` +
          `и <a href="${this.legalUrl("privacy")}">политикой обработки персональных данных</a> (152-ФЗ).</i>`,
        parse_mode: "HTML",
        link_preview_options: { is_disabled: true },
        reply_markup: {
          keyboard: [[{ text: SHARE_CONTACT_TEXT, request_contact: true }]],
          resize_keyboard: true,
          one_time_keyboard: true,
        },
      }),
    );
  }

  /** The same pages the Mini App's "Правовая информация" rows open — served by the web
   * container as plain pages, so they read fine in Telegram's in-app browser too. */
  private legalUrl(slug: "terms" | "privacy" | "personal-data"): string {
    return `${this.miniAppUrl ?? "https://amola-finance.ru"}/legal/${slug}`;
  }

  private async handleContact(message: TelegramMessage): Promise<void> {
    const from = message.from;
    const contact = message.contact;
    if (!from || !contact) return;
    // Only the sender's own number — a shared contact card can be anyone's.
    if (contact.user_id !== undefined && contact.user_id !== from.id) {
      this.sendStartButton(message.chat.id);
      return;
    }

    await this.users.setPhoneForTelegramIdentity(String(from.id), contact.phone_number);
    this.callApi("sendMessage", {
      chat_id: message.chat.id,
      text: "Спасибо! Номер сохранён.",
      reply_markup: { remove_keyboard: true },
    });
    this.sendStartButton(message.chat.id);
  }

  private sendStartButton(chatId: number): void {
    // CORS_ORIGIN (what miniAppUrl comes from) is required and must be an explicit https
    // origin in production — this only stays unset in a dev config that allows "*", where
    // there's no real Mini App URL to send anyway, and no public HTTPS webhook to receive
    // this update through in the first place.
    if (!this.miniAppUrl) {
      this.logger.warn("No CORS_ORIGIN to build a Mini App button from — sending text only");
      this.callApi("sendMessage", { chat_id: chatId, text: "Готово! Откройте приложение из меню бота." });
      return;
    }
    this.callApi("sendMessage", {
      chat_id: chatId,
      text: "Готово — открывайте приложение и начинайте вести финансы.",
      reply_markup: {
        inline_keyboard: [[{ text: START_TEXT, web_app: { url: this.miniAppUrl } }]],
      },
    });
  }

  /** Never rejects and is deliberately not awaited by the webhook path — see
   * `handleUpdate`. Returns the promise only so a caller can *order* two sends. */
  private callApi(method: string, body: Record<string, unknown>): Promise<void> {
    return fetch(`${this.apiUrl}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
      .then(async (res) => {
        if (!res.ok) this.logger.error(`Telegram ${method} failed: ${res.status} ${await res.text()}`);
      })
      .catch((error: unknown) => {
        this.logger.error(`Telegram ${method} threw: ${error instanceof Error ? error.message : error}`);
      });
  }
}
