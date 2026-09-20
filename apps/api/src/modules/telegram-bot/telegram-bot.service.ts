import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { parseCorsOrigins, type Env } from "../../config/env";
import { EntitlementsService } from "../entitlements/entitlements.service";
import { UsersService } from "../users/users.service";

import type { TelegramMessage, TelegramSuccessfulPayment, TelegramUpdate } from "./telegram-update";

const SHARE_CONTACT_TEXT = "📱 Поделиться номером";
const START_TEXT = "🚀 Начать";

/** Whole Stars, no decimal subdivision (unlike real-money currencies) — see
 * https://core.telegram.org/bots/payments-stars. */
export const PRO_MONTHLY_STARS = 199;
const PRO_MONTHLY_DAYS = 30;
/** Prefix for the invoice payload Telegram echoes back on successful_payment — see
 * handleSuccessfulPayment. Versioned loosely by including the plan name, so a second
 * plan/price later doesn't need a payload format change. */
const STARS_PAYLOAD_PREFIX = "pro_monthly";

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
    private readonly entitlements: EntitlementsService,
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
    if (update.pre_checkout_query) return this.handlePreCheckoutQuery(update.pre_checkout_query);

    const message = update.message;
    if (!message?.from) return;

    if (message.successful_payment) return this.handleSuccessfulPayment(message);
    if (message.text === "/start") return this.handleStart(message);
    if (message.contact) return this.handleContact(message);
    // Anything else — no command grammar to teach; the share-number keyboard is still up.
  }

  /** A public link that opens Telegram's native Stars payment sheet — from inside the
   * Mini App via `Telegram.WebApp.openInvoice`, or from any chat if just shared as a URL.
   * The payload is what ties a successful payment back to our own user id (see
   * handleSuccessfulPayment) — nothing about who opens or pays the link identifies them
   * on its own, since createInvoiceLink isn't addressed to any one chat. */
  async createStarsInvoiceLink(userId: string): Promise<string> {
    const body = await this.callApiAwaited("createInvoiceLink", {
      title: "Amola Finance Pro",
      description: "Голос и импорт без лимитов, дизайн карт банков — на 30 дней.",
      payload: `${STARS_PAYLOAD_PREFIX}:${userId}`,
      currency: "XTR",
      prices: [{ label: "Pro, 1 месяц", amount: PRO_MONTHLY_STARS }],
    });
    const url = (body as { result?: unknown }).result;
    if (typeof url !== "string") throw new Error("Telegram createInvoiceLink returned no url");
    return url;
  }

  /** Telegram blocks the payment on this for up to 10s — always approved: a subscription
   * has no stock to run out of, and price/currency were already fixed when the invoice
   * link was created, not something this side could revise now anyway. */
  private paymentUser(payment: { invoice_payload: string; currency: string; total_amount: number }): string | null {
    const match = /^pro_monthly:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.exec(payment.invoice_payload);
    return match && payment.currency === "XTR" && payment.total_amount === PRO_MONTHLY_STARS ? match[1]! : null;
  }

  private async handlePreCheckoutQuery(query: NonNullable<TelegramUpdate["pre_checkout_query"]>): Promise<void> {
    const userId = this.paymentUser(query);
    const ok = Boolean(userId && await this.entitlements.hasUser(userId));
    await this.callApiAwaited("answerPreCheckoutQuery", {
      pre_checkout_query_id: query.id, ok,
      ...(!ok ? { error_message: "Счёт устарел. Откройте Amola и создайте новый платёж." } : {}),
    });
  }

  /** The one place a Stars payment is trusted as real — this arrives from Telegram's own
   * servers (through the same secret-checked webhook every other update does), after
   * Telegram has already taken the user's Stars, not from anything the client claims. */
  private async handleSuccessfulPayment(message: TelegramMessage): Promise<void> {
    const payment = message.successful_payment as TelegramSuccessfulPayment;
    const userId = this.paymentUser(payment);
    if (!userId || !payment.telegram_payment_charge_id) {
      this.logger.error("Invalid Stars payment details");
      return;
    }

    const applied = await this.entitlements.applyStarsPayment(userId, payment.telegram_payment_charge_id, payment.total_amount, PRO_MONTHLY_DAYS);
    if (!applied) return;

    this.callApi("sendMessage", {
      chat_id: message.chat.id,
      text: `Готово! Pro активен${applied.expiresAt ? ` до ${applied.expiresAt.toLocaleDateString("ru-RU")}` : " без ограничения срока"}. Спасибо 💜`,
    });
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

  /** Unlike `callApi`, this one actually rejects and hands back Telegram's parsed
   * response body — for the few calls (currently just createInvoiceLink) whose result a
   * caller needs, as opposed to the fire-and-forget replies the webhook path sends. */
  private async callApiAwaited(method: string, body: Record<string, unknown>): Promise<unknown> {
    const res = await fetch(`${this.apiUrl}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const parsed: unknown = await res.json();
    if (!res.ok || (parsed as { ok?: boolean }).ok !== true) {
      throw new Error(`Telegram ${method} failed: ${res.status} ${JSON.stringify(parsed)}`);
    }
    return parsed;
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
