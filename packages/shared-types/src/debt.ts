import type { CurrencyCode, MinorUnits } from "./money";

/** Whose money it is: someone owes the app's user (`owed_to_me`), or the user owes
 * someone else (`i_owe`). Purely a personal ledger — no counterparty account, no
 * automatic settlement, just a note the user keeps and marks paid by hand. */
export type DebtDirection = "owed_to_me" | "i_owe";

export interface Debt {
  id: string;
  direction: DebtDirection;
  counterpartyName: string;
  amountMinor: MinorUnits;
  currency: CurrencyCode;
  note: string | null;
  dueDate: string | null;
  /** Set once the debt is paid back/collected — kept, not deleted, so past debts stay
   * visible in their own "settled" state instead of disappearing. */
  settledAt: string | null;
  createdAt: string;
}
