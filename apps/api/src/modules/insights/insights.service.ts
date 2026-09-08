import { addDays, averageDailySpend, dayOfMonth, percentChange, startOfDay, startOfMonth } from "@money-dock/business-rules";
import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, desc, eq, gt, gte, isNull, lt, sql } from "drizzle-orm";

import type { Database } from "../../db/client";
import { DATABASE } from "../../db/database.token";
import { categories, insights, reviewItems, transactions } from "../../db/schema";
import { AnalyticsService } from "../analytics/analytics.service";
import { UsersService } from "../users/users.service";

/** How far back "category growth" compares — spec example: "выросла на 4 800 ₽ за 30 дней". */
const GROWTH_WINDOW_DAYS = 30;
/** Below this absolute delta, a percentage swing is just noise on a small category. */
const GROWTH_MIN_ABSOLUTE_MINOR = 100_000; // 1 000 ₽
const GROWTH_MIN_PERCENT = 20;
/** How long a generated insight stays visible before it's due for a refresh. */
const INSIGHT_VALIDITY_DAYS = 7;

export interface DailySummary {
  yesterdayExpenseMinor: number;
  /** null when there's no baseline yet (yesterday was the 1st of the month). */
  yesterdayVsAverageChangePercent: number | null;
  safeToSpendPerDayMinor: number;
  reviewCount: number;
}

export type InsightCode = "category_growth";
export type InsightSeverity = "info" | "warning" | "critical";

export interface InsightItem {
  id: string;
  code: InsightCode;
  severity: InsightSeverity;
  /** The client renders the sentence from this key + `facts` (spec §20 Insight Engine —
   * template messages, not an LLM writer, for the MVP). */
  messageTemplateKey: string;
  facts: Record<string, unknown>;
  priority: number;
  createdAt: string;
  readAt: string | null;
}

/**
 * The "Financial Director" — daily summary plus persisted, actionable insights. Every
 * number here comes from SQL/TS aggregates already computed elsewhere (AnalyticsService,
 * ReviewInboxService's own table); nothing is summed or forecast by a model.
 */
@Injectable()
export class InsightsService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly analytics: AnalyticsService,
    private readonly users: UsersService,
  ) {}

  async getDailySummary(userId: string, now = new Date()): Promise<DailySummary> {
    const user = await this.users.getById(userId);
    const tz = user.timezone;

    const todayStart = startOfDay(now, tz);
    const yesterdayStart = addDays(todayStart, -1);
    const monthStart = startOfMonth(now, tz);
    // Days strictly before yesterday, in the current month — the baseline "average" that
    // yesterday's spend is compared against. Zero when yesterday was the 1st.
    const baselineDays = Math.max(dayOfMonth(yesterdayStart, tz) - 1, 0);

    const [yesterdayExpenseMinor, baselineExpenseMinor, reviewCount, summary] = await Promise.all([
      this.periodExpense(userId, yesterdayStart, todayStart),
      baselineDays > 0 ? this.periodExpense(userId, monthStart, yesterdayStart) : Promise.resolve(0),
      this.pendingReviewCount(userId),
      this.analytics.getSummary(userId, now),
    ]);

    const averageDailyBaseline = averageDailySpend(baselineExpenseMinor, baselineDays);

    return {
      yesterdayExpenseMinor,
      yesterdayVsAverageChangePercent:
        baselineDays > 0 ? percentChange(averageDailyBaseline, yesterdayExpenseMinor) : null,
      safeToSpendPerDayMinor: summary.safeToSpendPerDayMinor,
      reviewCount,
    };
  }

  /** Refreshes category-growth insights, then returns everything still valid, highest
   * priority first. Capped — this is a short "worth a look" list, not a full report. */
  async listInsights(userId: string, now = new Date()): Promise<InsightItem[]> {
    await this.refreshCategoryGrowthInsights(userId, now);

    const rows = await this.db
      .select()
      .from(insights)
      .where(and(eq(insights.userId, userId), gt(insights.validUntil, now)))
      .orderBy(desc(insights.priority), desc(insights.createdAt))
      .limit(5);

    return rows.map((row) => ({
      id: row.id,
      code: row.type,
      severity: row.severity,
      messageTemplateKey: row.messageTemplateKey,
      facts: row.payloadJson as Record<string, unknown>,
      priority: row.priority,
      createdAt: row.createdAt.toISOString(),
      readAt: row.readAt?.toISOString() ?? null,
    }));
  }

  async markRead(userId: string, id: string): Promise<void> {
    const updated = await this.db
      .update(insights)
      .set({ readAt: new Date() })
      .where(and(eq(insights.id, id), eq(insights.userId, userId)))
      .returning({ id: insights.id });
    if (updated.length === 0) throw new NotFoundException("Insight not found");
  }

  private async refreshCategoryGrowthInsights(userId: string, now: Date): Promise<void> {
    const currentStart = addDays(now, -GROWTH_WINDOW_DAYS);
    const previousStart = addDays(currentStart, -GROWTH_WINDOW_DAYS);

    const [current, previous] = await Promise.all([
      this.categoryExpenseTotals(userId, currentStart, now),
      this.categoryExpenseTotals(userId, previousStart, currentStart),
    ]);
    const previousByCategory = new Map(previous.map((row) => [row.categoryId, row.totalMinor]));

    for (const row of current) {
      if (!row.categoryId) continue;
      const previousMinor = previousByCategory.get(row.categoryId) ?? 0;
      // No real baseline to grow from — comparing against near-zero produces a huge,
      // meaningless percentage (e.g. a brand-new category "growing" 900%).
      if (previousMinor < GROWTH_MIN_ABSOLUTE_MINOR) continue;

      const growthMinor = row.totalMinor - previousMinor;
      if (growthMinor < GROWTH_MIN_ABSOLUTE_MINOR) continue;
      const growthPercent = percentChange(previousMinor, row.totalMinor);
      if (growthPercent === null || growthPercent < GROWTH_MIN_PERCENT) continue;

      const roundedGrowthPercent = Math.round(growthPercent);
      const [existing] = await this.db
        .select({ payloadJson: insights.payloadJson })
        .from(insights)
        .where(
          and(
            eq(insights.userId, userId),
            eq(insights.type, "category_growth"),
            eq(insights.entityId, row.categoryId),
          ),
        );
      // Same facts as last time — leave the row (and its read state) untouched. Only
      // extending `validUntil` on every list-fetch would make an already-read insight
      // that the user dismissed keep resurfacing forever just because it's still true.
      const existingPayload = existing?.payloadJson as
        | { currentMinor?: number; previousMinor?: number }
        | undefined;
      if (
        existingPayload &&
        existingPayload.currentMinor === row.totalMinor &&
        existingPayload.previousMinor === previousMinor
      ) {
        continue;
      }

      const categoryName = await this.categoryName(row.categoryId);
      const payloadJson = {
        categoryId: row.categoryId,
        categoryName,
        currentMinor: row.totalMinor,
        previousMinor,
        growthPercent: roundedGrowthPercent,
        windowDays: GROWTH_WINDOW_DAYS,
      };
      const severity = growthPercent >= 50 ? "warning" : "info";

      await this.db
        .insert(insights)
        .values({
          userId,
          type: "category_growth",
          entityId: row.categoryId,
          severity,
          payloadJson,
          messageTemplateKey: "insight.category_growth",
          priority: Math.min(100, roundedGrowthPercent),
          validUntil: addDays(now, INSIGHT_VALIDITY_DAYS),
        })
        .onConflictDoUpdate({
          target: [insights.userId, insights.type, insights.entityId],
          set: {
            severity,
            payloadJson,
            priority: Math.min(100, roundedGrowthPercent),
            validUntil: addDays(now, INSIGHT_VALIDITY_DAYS),
            // The underlying fact changed since it was last shown — worth surfacing again.
            readAt: null,
          },
        });
    }
  }

  private async periodExpense(userId: string, from: Date, to: Date): Promise<number> {
    const [row] = await this.db
      .select({
        total:
          sql<number>`coalesce(sum(case when ${transactions.type} = 'expense' then ${transactions.amountMinor} else 0 end), 0)`.mapWith(
            Number,
          ),
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          isNull(transactions.deletedAt),
          gte(transactions.occurredAt, from),
          lt(transactions.occurredAt, to),
        ),
      );
    return row?.total ?? 0;
  }

  private async categoryExpenseTotals(
    userId: string,
    from: Date,
    to: Date,
  ): Promise<Array<{ categoryId: string | null; totalMinor: number }>> {
    return this.db
      .select({
        categoryId: transactions.categoryId,
        totalMinor: sql<number>`coalesce(sum(${transactions.amountMinor}), 0)`.mapWith(Number),
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          eq(transactions.type, "expense"),
          isNull(transactions.deletedAt),
          gte(transactions.occurredAt, from),
          lt(transactions.occurredAt, to),
        ),
      )
      .groupBy(transactions.categoryId);
  }

  private async categoryName(categoryId: string): Promise<string> {
    const [row] = await this.db.select({ name: categories.name }).from(categories).where(eq(categories.id, categoryId));
    return row?.name ?? "Категория";
  }

  private async pendingReviewCount(userId: string): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(reviewItems)
      .where(and(eq(reviewItems.userId, userId), eq(reviewItems.status, "pending")));
    return row?.count ?? 0;
  }
}
