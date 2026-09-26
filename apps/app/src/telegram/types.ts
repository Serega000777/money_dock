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
  initDataUnsafe: { user?: TelegramUser; start_param?: string };
  colorScheme: "light" | "dark";
  themeParams: TelegramThemeParams;
  platform: string;
  isExpanded: boolean;
  ready: () => void;
  expand: () => void;
  close: () => void;
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
  setBottomBarColor?: (color: string) => void;
  onEvent: (event: string, handler: () => void) => void;
  offEvent: (event: string, handler: () => void) => void;
  /** Opens Telegram's native Stars payment sheet for an invoice link created via the Bot
   * API's createInvoiceLink. `status` mirrors the successful_payment/failed webhook. */
  openInvoice?: (url: string, callback: (status: "paid" | "cancelled" | "failed" | "pending") => void) => void;
  /** For a t.me link (support/feedback chat) — inside the Mini App's sandboxed WebView, a
   * plain window.open is unreliable, so this is Telegram's own way to hand it to the client. */
  openTelegramLink?: (url: string) => void;
  /** Any other external link (mailto:, https:) — opens outside the Mini App. */
  openLink?: (url: string) => void;
  /** Native tap feedback — the only way to get an iOS/Android haptic buzz from a Mini
   * App; the web platform has no equivalent (Safari never shipped navigator.vibrate). */
  HapticFeedback?: {
    impactOccurred: (style: "light" | "medium" | "heavy" | "rigid" | "soft") => void;
    notificationOccurred: (type: "error" | "success" | "warning") => void;
    selectionChanged: () => void;
  };
}

export interface TelegramWindow {
  Telegram?: { WebApp?: TelegramWebApp };
}
