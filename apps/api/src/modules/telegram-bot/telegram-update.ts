/** The small slice of Telegram's Bot API update shape this module actually reads — not a
 * full SDK, since the only two things the bot does are read a text command and a shared
 * contact. https://core.telegram.org/bots/api#update */
export interface TelegramUpdate {
  message?: TelegramMessage;
}

export interface TelegramMessage {
  chat: { id: number };
  from?: { id: number; first_name: string; last_name?: string; username?: string; language_code?: string };
  text?: string;
  contact?: { phone_number: string; user_id?: number };
}
