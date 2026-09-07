import { createApiClient } from "@money-dock/api-client";

import { useAuthStore } from "../auth/authStore";

const baseUrl = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";

export const apiClient = createApiClient({
  baseUrl,
  getAccessToken: () => useAuthStore.getState().accessToken,

  /**
   * Access tokens last 15 minutes; this rotates them in the background so a session
   * survives. A refresh token that's been revoked or has expired clears the session, and
   * AuthProvider signs back in on the next render.
   */
  onUnauthorized: async () => {
    const { refreshToken, userId, setTokens, clear } = useAuthStore.getState();
    if (!refreshToken) return null;

    try {
      const tokens = await apiClient.auth.refresh(refreshToken);
      setTokens({ ...tokens, userId: userId ?? "" });
      return tokens.accessToken;
    } catch {
      clear();
      return null;
    }
  },
});
