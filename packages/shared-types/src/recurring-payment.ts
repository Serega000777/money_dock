import type { CurrencyCode, MinorUnits } from "./money";

/** A regular payment the user set up themselves (e.g. "Окко, 299₽/мес") — a reminder to
 * log, not an auto-charging subscription: paying one creates a real transaction and
 * stamps `lastPaidAt`, nothing happens on its own. Always monthly; `dueDay` (1-31) is
 * the day of the month it's due, or null for "sometime this month", no fixed date. */
export interface RecurringPayment {
  id: string;
  accountId: string;
  categoryId: string | null;
  name: string;
  amountMinor: MinorUnits;
  currency: CurrencyCode;
  dueDay: number | null;
  /** Days before `dueDay` to flag it as coming up; meaningless when `dueDay` is null. */
  reminderDaysBefore: number | null;
  lastPaidAt: string | null;
  createdAt: string;
}
