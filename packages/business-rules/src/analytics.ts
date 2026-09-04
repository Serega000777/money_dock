/**
 * Deterministic analytics formulas — no LLM in this file, ever (ADR 0005 / product spec:
 * "нейросеть только объясняет, деньги считает код"). Each function is pure so it can be
 * unit-tested in isolation from the database.
 */

/** null means "undefined growth" (previous period had nothing to grow from) — the caller
 * decides how to present that (e.g. "новое" instead of a percentage). */
export function percentChange(previousMinor: number, currentMinor: number): number | null {
  if (previousMinor === 0) return currentMinor === 0 ? 0 : null;
  return ((currentMinor - previousMinor) / previousMinor) * 100;
}

export function averageDailySpend(expenseMinor: number, elapsedDays: number): number {
  return elapsedDays > 0 ? expenseMinor / elapsedDays : 0;
}

export function medianDailySpend(dailyExpensesMinor: readonly number[]): number {
  if (dailyExpensesMinor.length === 0) return 0;
  const sorted = [...dailyExpensesMinor].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

/** How much can be spent per day, for the rest of the period, without running the
 * total balance below zero. Never negative — a depleted balance means 0, not debt advice. */
export function safeToSpendPerDay(currentBalanceMinor: number, daysRemaining: number): number {
  if (daysRemaining <= 0) return Math.max(0, currentBalanceMinor);
  return Math.max(0, currentBalanceMinor / daysRemaining);
}

/** Projected balance at the end of the period if spending continues at `avgDailySpendMinor`. */
export function monthEndForecast(
  currentBalanceMinor: number,
  avgDailySpendMinor: number,
  daysRemaining: number,
): number {
  return currentBalanceMinor - avgDailySpendMinor * daysRemaining;
}
