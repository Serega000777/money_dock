import type { CurrencyCode, MinorUnits } from "./money";

export type AccountType = "cash" | "card" | "bank";
/** Which bank's card design a `card` account is drawn with — cosmetic only. */
export type Bank = "sber" | "alfa" | "tinkoff" | "vtb" | "ozon" | "bank_russia" | "gazprombank";
export type AccountRole = "owner" | "member" | "viewer";

export interface AccountMember {
  userId: string;
  displayName: string;
  role: AccountRole;
  createdAt: string;
}

export interface Account {
  id: string;
  type: AccountType;
  name: string;
  currency: CurrencyCode;
  initialBalanceMinor: MinorUnits;
  currentBalanceMinor: MinorUnits;
  bank: Bank | null;
  cardLast4: string | null;
  archivedAt: string | null;
  role: AccountRole;
}

export interface AccountInvitePreview {
  accountName: string;
  inviterName: string;
  role: Exclude<AccountRole, "owner">;
  expiresAt: string | null;
}
