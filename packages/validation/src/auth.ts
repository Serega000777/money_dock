import { z } from "zod";

export const telegramAuthSchema = z.object({
  initData: z.string().min(1),
});
export type TelegramAuthInput = z.infer<typeof telegramAuthSchema>;

/** The identity token comes directly from AuthenticationServices on the device. The
 * server verifies its Apple signature, issuer and audience before trusting any claim. */
export const appleAuthSchema = z.object({
  identityToken: z.string().min(1),
  displayName: z.string().trim().min(1).max(120).optional(),
});
export type AppleAuthInput = z.infer<typeof appleAuthSchema>;

/**
 * Shared shape for OAuth authorization-code providers (Yandex ID, VK ID): the client
 * exchanges the provider's login screen for a one-time `code`, and the server exchanges
 * that code for the user's identity server-to-server. `redirectUri` must be echoed back
 * exactly as sent to the provider's authorization endpoint — both OAuth 2.0 providers
 * validate it matches. Neither provider is wired yet (see AuthService.loginWithYandex /
 * loginWithVk); this schema is scaffolding for that work.
 */
export const oauthCodeAuthSchema = z.object({
  code: z.string().min(1),
  redirectUri: z.string().min(1),
});
export type OAuthCodeAuthInput = z.infer<typeof oauthCodeAuthSchema>;

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});
export type RefreshInput = z.infer<typeof refreshSchema>;
