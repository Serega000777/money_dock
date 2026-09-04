/**
 * Minimal typing for the object Telegram injects as `window.Telegram.WebApp` inside a
 * Mini App WebView. Deliberately hand-typed (not the full Bot API surface) so domain and
 * screen code only ever depends on this narrow interface, never on the global directly.
 * See: https://core.telegram.org/bots/webapps
 */
export interface TelegramThemeParams {
  bg_color?: string;
  text_color?: string;
  hint_color?: string;
  link_color?: string;
  button_color?: string;
  button_text_color?: string;
  secondary_bg_color?: string;
}

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

export interface TelegramWebApp {
  initData: string;
  initDataUnsafe: { user?: TelegramUser };
  colorScheme: "light" | "dark";
  themeParams: TelegramThemeParams;
  platform: string;
  isExpanded: boolean;
  ready: () => void;
  expand: () => void;
  close: () => void;
  onEvent: (event: string, handler: () => void) => void;
  offEvent: (event: string, handler: () => void) => void;
}

export interface TelegramWindow {
  Telegram?: { WebApp?: TelegramWebApp };
}
