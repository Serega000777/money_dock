import { createApiClient } from "@money-dock/api-client";

const baseUrl = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";

export const apiClient = createApiClient({ baseUrl });
