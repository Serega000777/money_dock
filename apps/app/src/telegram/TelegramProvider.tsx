import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import type { TelegramUser, TelegramWebApp } from "./types";
import { getTelegramWebApp } from "./webapp";

interface TelegramContextValue {
  webApp: TelegramWebApp | null;
  isInsideTelegram: boolean;
  initData: string | null;
  user: TelegramUser | null;
}

const TelegramContext = createContext<TelegramContextValue>({
  webApp: null,
  isInsideTelegram: false,
  initData: null,
  user: null,
});

export function TelegramProvider({ children }: { children: ReactNode }) {
  const [webApp, setWebApp] = useState(getTelegramWebApp);

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
    };
  }, [webApp]);

  return <TelegramContext.Provider value={value}>{children}</TelegramContext.Provider>;
}

/** Auth and domain code should depend on this hook, never on `window.Telegram` directly. */
export function useTelegram(): TelegramContextValue {
  return useContext(TelegramContext);
}
