import { darkTheme, lightTheme, textScale, type Theme } from "@money-dock/design-tokens";
import { useColorScheme } from "react-native";

import { useTelegram } from "../telegram/TelegramProvider";

import { useSettingsStore } from "./settingsStore";

/**
 * The user's explicit choice wins; "system" follows Telegram's scheme inside the Mini App
 * and the OS on the web, so the app never looks foreign in either host.
 */
export function useTheme(): Theme {
  const mode = useSettingsStore((state) => state.themeMode);
  // From TelegramProvider's own React state (kept in sync with a `themeChanged`
  // listener), not `webApp.colorScheme` read directly — that property can still change
  // after this component's first render, with nothing to trigger a re-render when it
  // does (see the comment in TelegramProvider.tsx).
  const { colorScheme: telegramColorScheme } = useTelegram();
  const systemScheme = useColorScheme();

  if (mode !== "system") return mode === "dark" ? darkTheme : lightTheme;
  const scheme = telegramColorScheme ?? systemScheme ?? "light";
  return scheme === "dark" ? darkTheme : lightTheme;
}

/** Multiplier applied to every font size by the shared <Text>. */
export function useTextScale(): number {
  return textScale[useSettingsStore((state) => state.textScale)];
}
