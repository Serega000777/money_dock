import type { MinorUnits } from "./money";

export interface AnalyticsSummary {
  totalBalanceMinor: MinorUnits;
  safeToSpendPerDayMinor: MinorUnits;
  daysRemainingInMonth: number;
  daysInMonth: number;
  monthEndForecastMinor: MinorUnits;
  currentMonthExpenseMinor: MinorUnits;
  currentMonthIncomeMinor: MinorUnits;
  /** null = previous comparable period had zero expense (undefined growth). */
  expenseChangePercent: number | null;
  todayExpenseMinor: MinorUnits;
}
