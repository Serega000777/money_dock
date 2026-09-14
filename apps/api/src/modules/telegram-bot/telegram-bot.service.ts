import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { parseCorsOrigins, type Env } from "../../config/env";
import { UsersService } from "../users/users.service";

import type { TelegramMessage, TelegramUpdate } from "./telegram-update";

const SKIP_TEXT = "Пропустить";
const SHARE_CONTACT_TEXT = "📱 Поделиться номером";
const START_TEXT = "🚀 Начать";

const WELCOME_TEXT =
  "Добро пожаловать в Amola Finance 💜 Удобно следи за финансами\n\n" +
  "Добавляй расходы или доходы голосом или вручную, следите за балансом, замечайте лишние траты и смотрите, куда на самом деле уходят деньги.\n\n" +
  "Просто скажите:\n" +
  "«Такси 850 рублей»\n" +
  "— и Amola всё запишет сама.\n\n" +
  "Здесь вы сможете:\n" +
  "• учитывать доходы и расходы\n" +
  "• добавлять операции голосом\n" +
  "• видеть понятную аналитику\n" +
  "• следить за бюджетом\n" +
  "• создавать финансовые цели\n" +
  "• подключать и импортировать данные из банков\n\n" +
  "Начнем?";

/**
 * The bot side of onboarding: a /start welcome, an optional phone number (Telegram's own
 * "share contact" button — never a typed field, so the number always comes from Telegram
 * itself, not a spoofable text message), then a button into the Mini App. Registration
 * itself doesn't wait on any of this — `findOrCreateByTelegramIdentity` runs the moment
 * /start arrives, the same call the Mini App's own silent login makes, so chatting with
 * the bot first and opening the app first land on the exact same account either way.
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
    this.bannerUrl = config.get("TELEGRAM_BANNER_URL", { infer: true });

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
    if (message.text === SKIP_TEXT) {
      this.sendStartButton(message.chat.id);
      return;
    }
    // Anything else — no command grammar to teach, just re-offer the one real action.
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

    const replyMarkup = {
      keyboard: [[{ text: SHARE_CONTACT_TEXT, request_contact: true }], [{ text: SKIP_TEXT }]],
      resize_keyboard: true,
      one_time_keyboard: true,
    };

    if (this.bannerUrl) {
      this.callApi("sendPhoto", {
        chat_id: message.chat.id,
        photo: this.bannerUrl,
        caption: WELCOME_TEXT,
        reply_markup: replyMarkup,
      });
    } else {
      this.callApi("sendMessage", { chat_id: message.chat.id, text: WELCOME_TEXT, reply_markup: replyMarkup });
    }
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

  /** Deliberately not `async`/awaited by its callers — see `handleUpdate`. */
  private callApi(method: string, body: Record<string, unknown>): void {
    fetch(`${this.apiUrl}/${method}`, {
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
