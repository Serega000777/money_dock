/** The small slice of Telegram's Bot API update shape this module actually reads — not a
 * full SDK. https://core.telegram.org/bots/api#update */
export interface TelegramUpdate {
  message?: TelegramMessage;
  pre_checkout_query?: TelegramPreCheckoutQuery;
}

export interface TelegramMessage {
  chat: { id: number };
  from?: { id: number; first_name: string; last_name?: string; username?: string; language_code?: string };
  text?: string;
  contact?: { phone_number: string; user_id?: number };
  successful_payment?: TelegramSuccessfulPayment;
}

/** Telegram requires `answerPreCheckoutQuery` within 10s of this arriving, ok:true or
 * false — see TelegramBotService.handlePreCheckout. */
export interface TelegramPreCheckoutQuery {
  id: string;
  from: { id: number };
  currency: string;
  total_amount: number;
  invoice_payload: string;
}

/** Arrives as a field on a normal `message` update, from the user's own chat with the
 * bot — the one and only place a Stars payment is confirmed as real. */
export interface TelegramSuccessfulPayment {
  currency: string;
  total_amount: number;
  invoice_payload: string;
  telegram_payment_charge_id: string;
}
