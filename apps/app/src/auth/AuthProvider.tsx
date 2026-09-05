import { useEffect } from "react";
import type { ReactNode } from "react";

import { apiClient } from "../api/client";
import { useTelegram } from "../telegram/TelegramProvider";

import { useAuthStore } from "./authStore";

/**
 * Signs in as soon as possible: with Telegram initData inside Telegram, and with the
 * dev/demo user when the app is opened as a plain website (that endpoint 404s in
 * production, so this can't become a backdoor).
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const { initData, isInsideTelegram } = useTelegram();
  const accessToken = useAuthStore((state) => state.accessToken);
  const setTokens = useAuthStore((state) => state.setTokens);

  useEffect(() => {
    if (accessToken) return;
    if (isInsideTelegram && !initData) return;

    let cancelled = false;
    const login =
      isInsideTelegram && initData
        ? apiClient.auth.loginWithTelegram(initData)
        : apiClient.auth.devLogin();

    login
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
