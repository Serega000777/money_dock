import type { CurrencyCode, MinorUnits } from "./money";

/** A saving target ("Отпуск — 200 000 ₽") and how much is earmarked for it so far. A
 * tracker, not money movement: contributing bumps `savedMinor` and creates no
 * transaction — the cash is already in one of the user's accounts. */
export interface SavingsGoal {
  id: string;
  name: string;
  /** One of the app's own icon names; null = default. */
  icon: string | null;
  targetMinor: MinorUnits;
  savedMinor: MinorUnits;
  currency: CurrencyCode;
  /** YYYY-MM-DD or null. */
  deadline: string | null;
  createdAt: string;
}
