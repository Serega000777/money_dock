import { darkTheme, lightTheme, type Theme } from "@money-dock/design-tokens";
import { useColorScheme } from "react-native";

import { useTelegram } from "../telegram/TelegramProvider";

/** Prefers Telegram's color scheme (matches the user's Telegram theme) and falls back to the OS. */
export function useTheme(): Theme {
  const { webApp } = useTelegram();
  const systemScheme = useColorScheme();
  const scheme = webApp?.colorScheme ?? systemScheme ?? "light";
  return scheme === "dark" ? darkTheme : lightTheme;
}
