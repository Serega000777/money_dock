import type { CurrencyCode, MinorUnits } from "./money";

export type AccountType = "cash" | "card" | "bank";

export interface Account {
  id: string;
  type: AccountType;
  name: string;
  currency: CurrencyCode;
  initialBalanceMinor: MinorUnits;
  currentBalanceMinor: MinorUnits;
  archivedAt: string | null;
}
