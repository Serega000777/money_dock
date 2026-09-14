import type { CurrencyCode } from "./money";

export type UserStatus = "active" | "suspended" | "deleted";
export type UserRole = "user" | "admin";

export interface User {
  id: string;
  displayName: string;
  baseCurrency: CurrencyCode;
  timezone: string;
  locale: string;
  /** A small data: URI (client resizes before upload), or null for the initial-letter
   * fallback avatar. */
  avatarUrl: string | null;
  role: UserRole;
  status: UserStatus;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}
