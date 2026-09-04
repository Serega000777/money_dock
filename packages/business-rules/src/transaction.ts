import { asMinorUnits, type Money } from "@money-dock/shared-types";

import { sumMoney } from "./money";

export class SplitSumMismatchError extends Error {
  constructor(expectedMinor: number, actualMinor: number) {
    super(`Split amounts sum to ${actualMinor}, expected ${expectedMinor}`);
    this.name = "SplitSumMismatchError";
  }
}

/** Split amounts must add up exactly to the parent transaction's amount. */
export function assertSplitsMatchTotal(total: Money, splitAmounts: readonly number[]): void {
  const splitMoney: Money[] = splitAmounts.map((amountMinor) => ({
    amountMinor: asMinorUnits(amountMinor),
    currency: total.currency,
  }));
  const sum = sumMoney(splitMoney, total.currency);
  if (sum.amountMinor !== total.amountMinor) {
    throw new SplitSumMismatchError(total.amountMinor, sum.amountMinor);
  }
}
