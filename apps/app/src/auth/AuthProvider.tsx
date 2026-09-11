import { useEffect } from "react";
import type { ReactNode } from "react";

import { apiClient } from "../api/client";
import { useTelegram } from "../telegram/TelegramProvider";

import { useAuthStore } from "./authStore";

/**
 * Signs in as soon as possible when running inside a real Telegram Mini App — the launch
 * itself already proves identity via `initData`, so there is nothing for the user to
 * choose or confirm. Outside Telegram (plain browser, or a future standalone mobile app)
 * this deliberately does nothing: `apps/app/app/sign-in.tsx` is the entry point there, and
 * `signInDemo()` below is what it calls for the browser/demo path that used to run here
 * automatically.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const { initData, isInsideTelegram } = useTelegram();
  const accessToken = useAuthStore((state) => state.accessToken);
  const setTokens = useAuthStore((state) => state.setTokens);

  useEffect(() => {
    if (accessToken) return;
    if (!isInsideTelegram || !initData) return;

    let cancelled = false;
    apiClient.auth
      .loginWithTelegram(initData)
      .then((res) => {
        if (!cancelled) {
          setTokens({
            accessToken: res.accessToken,
            refreshToken: res.refreshToken,
            userId: res.user.id,
          });
        }
      })
      .catch(() => {
        // Home screen falls back to demo-mode copy when there's no access token.
      });

    return () => {
      cancelled = true;
    };
  }, [isInsideTelegram, initData, accessToken, setTokens]);

  return <>{children}</>;
}

/** The browser/demo entry point (`/auth/dev-login` — 404s in production) that `AuthProvider`
 * used to call automatically outside Telegram. Now a conscious action from the sign-in
 * screen, alongside the Telegram/Yandex ID/VK ID buttons. */
export async function signInDemo(): Promise<void> {
  const res = await apiClient.auth.devLogin();
  useAuthStore.getState().setTokens({
    accessToken: res.accessToken,
    refreshToken: res.refreshToken,
    userId: res.user.id,
  });
}
