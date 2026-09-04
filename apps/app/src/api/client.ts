import { createApiClient } from "@money-dock/api-client";

import { useAuthStore } from "../auth/authStore";

const baseUrl = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";

export const apiClient = createApiClient({
  baseUrl,
  getAccessToken: () => useAuthStore.getState().accessToken,
});
