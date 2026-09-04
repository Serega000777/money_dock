import type { CurrencyCode } from "./money";

export type UserStatus = "active" | "suspended" | "deleted";

export interface User {
  id: string;
  displayName: string;
  baseCurrency: CurrencyCode;
  timezone: string;
  locale: string;
  status: UserStatus;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}
