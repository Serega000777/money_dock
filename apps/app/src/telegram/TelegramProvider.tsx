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
  const [webApp] = useState(getTelegramWebApp);

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
