import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import type { TelegramUser, TelegramWebApp } from "./types";
import { getTelegramWebApp } from "./webapp";

interface TelegramContextValue {
  webApp: TelegramWebApp | null;
  isInsideTelegram: boolean;
  initData: string | null;
  user: TelegramUser | null;
  startParam: string | null;
  /** `webApp.colorScheme` as of the last `themeChanged` event — see the note below on
   * why this can't just be read directly off `webApp` in the consumer. */
  colorScheme: "light" | "dark" | null;
}

const TelegramContext = createContext<TelegramContextValue>({
  webApp: null,
  isInsideTelegram: false,
  initData: null,
  user: null,
  startParam: null,
  colorScheme: null,
});

export function TelegramProvider({ children }: { children: ReactNode }) {
  const [webApp, setWebApp] = useState(getTelegramWebApp);
  const [colorScheme, setColorScheme] = useState<"light" | "dark" | null>(
    () => getTelegramWebApp()?.colorScheme ?? null,
  );

  // telegram-web-app.js may still be loading when React first renders; without this
  // re-check we'd latch "not in Telegram" forever and never send initData to the API.
  useEffect(() => {
    if (webApp) return;
    const found = getTelegramWebApp();
    if (found) setWebApp(found);
  }, [webApp]);

  useEffect(() => {
    webApp?.ready();
    webApp?.expand();
  }, [webApp]);

  // `colorScheme` is a plain property on the Telegram object, not React state — Telegram
  // can still be resolving the client's real theme (a round trip, not always known at
  // launch) when this component first mounts, and nothing re-renders when that finishes
  // unless something is actually listening for it. Without this, the app could render
  // once against a wrong/default scheme and then never again — which is exactly what
  // made toggling the theme in Settings look like it "fixed" a dark launch that had
  // opened light: that flip is itself a re-render, so it happens to pick up the by-then-
  // correct `webApp.colorScheme` that this effect would otherwise have delivered sooner.
  useEffect(() => {
    if (!webApp) return;
    setColorScheme(webApp.colorScheme);
    const handleThemeChanged = () => setColorScheme(webApp.colorScheme);
    webApp.onEvent("themeChanged", handleThemeChanged);
    return () => webApp.offEvent("themeChanged", handleThemeChanged);
  }, [webApp]);

  const value = useMemo<TelegramContextValue>(() => {
    // telegram-web-app.js defines window.Telegram.WebApp as a stub even outside Telegram
    // (so devs can test the page directly in a browser) — its `initData` is only ever
    // non-empty when actually launched from a real Telegram client with launch params.
    const initData = webApp?.initData || null;
    return {
      webApp,
      isInsideTelegram: initData !== null,
      initData,
      user: webApp?.initDataUnsafe.user ?? null,
      startParam: webApp?.initDataUnsafe.start_param ?? null,
      colorScheme: initData ? colorScheme : null,
    };
  }, [webApp, colorScheme]);

  return <TelegramContext.Provider value={value}>{children}</TelegramContext.Provider>;
}

/** Auth and domain code should depend on this hook, never on `window.Telegram` directly. */
export function useTelegram(): TelegramContextValue {
  return useContext(TelegramContext);
}
