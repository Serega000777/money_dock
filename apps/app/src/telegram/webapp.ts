import { Platform } from "react-native";

import type { TelegramWebApp, TelegramWindow } from "./types";

/**
 * Returns the Telegram bridge when running as a Mini App inside Telegram's web client,
 * or null on native builds and when opened as a plain website (demo mode).
 */
export function getTelegramWebApp(): TelegramWebApp | null {
  if (Platform.OS !== "web") return null;
  const webApp = (globalThis as unknown as TelegramWindow).Telegram?.WebApp;
  return webApp ?? null;
}
