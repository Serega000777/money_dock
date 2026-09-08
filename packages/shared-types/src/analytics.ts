import type { MinorUnits } from "./money";

export interface AnalyticsSummary {
  totalBalanceMinor: MinorUnits;
  safeToSpendPerDayMinor: MinorUnits;
  daysRemainingInMonth: number;
  daysInMonth: number;
  monthEndForecastMinor: MinorUnits;
  currentMonthExpenseMinor: MinorUnits;
  currentMonthIncomeMinor: MinorUnits;
  /** Same total as currentMonthExpenseMinor, split by how it was paid — cash accounts
   * vs. card/bank accounts combined (spec: track spend by payment method on the home
   * screen instead of a generic "% of month elapsed" bar). */
  currentMonthExpenseCashMinor: MinorUnits;
  currentMonthExpenseBankMinor: MinorUnits;
  /** null = previous comparable period had zero expense (undefined growth). */
  expenseChangePercent: number | null;
  todayExpenseMinor: MinorUnits;
}
