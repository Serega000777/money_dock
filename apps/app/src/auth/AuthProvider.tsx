import { useEffect } from "react";
import type { ReactNode } from "react";

import { apiClient } from "../api/client";
import { useTelegram } from "../telegram/TelegramProvider";

import { useAuthStore } from "./authStore";

/** Logs into the API with the Telegram initData as soon as it's available. No-op outside Telegram. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const { initData, isInsideTelegram } = useTelegram();
  const accessToken = useAuthStore((state) => state.accessToken);
  const setTokens = useAuthStore((state) => state.setTokens);

  useEffect(() => {
    if (!isInsideTelegram || !initData || accessToken) return;

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
