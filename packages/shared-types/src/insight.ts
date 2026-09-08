export interface DailySummary {
  yesterdayExpenseMinor: number;
  /** null when there's no baseline yet (yesterday was the 1st of the month). */
  yesterdayVsAverageChangePercent: number | null;
  safeToSpendPerDayMinor: number;
  reviewCount: number;
}

export type InsightCode = "category_growth";
export type InsightSeverity = "info" | "warning" | "critical";

export interface CategoryGrowthFacts {
  categoryId: string;
  categoryName: string;
  currentMinor: number;
  previousMinor: number;
  growthPercent: number;
  windowDays: number;
}

export interface Insight {
  id: string;
  code: InsightCode;
  severity: InsightSeverity;
  /** The client renders the sentence from this key + `facts` — the server never
   * formulates the sentence itself (spec §20: template messages, not an LLM writer). */
  messageTemplateKey: string;
  facts: CategoryGrowthFacts;
  priority: number;
  createdAt: string;
  readAt: string | null;
}
