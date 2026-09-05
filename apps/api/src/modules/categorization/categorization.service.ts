import { normalizeMerchant } from "@money-dock/business-rules";
import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq, isNotNull, sql } from "drizzle-orm";

import type { Database } from "../../db/client";
import { DATABASE } from "../../db/database.token";
import { categoryRules, transactions } from "../../db/schema";

export type CategorizationSource = "user_rule" | "merchant_history" | "uncategorized";

export interface CategorizationResult {
  categoryId: string | null;
  /** 0-100. Anything below the review bar lands in the Review Inbox. */
  confidence: number;
  source: CategorizationSource;
  explanationCode: string;
}

/** Below this, the transaction goes to the Review Inbox instead of being trusted. */
export const REVIEW_CONFIDENCE_THRESHOLD = 60;

/**
 * Priority order (spec): personal rule → the user's own history for this merchant →
 * uncategorized/review. MCC, global merchant aliases and an LLM fallback slot in above
 * "uncategorized" later without changing callers.
 */
@Injectable()
export class CategorizationService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async categorize(
    userId: string,
    merchant: string | null | undefined,
  ): Promise<CategorizationResult> {
    if (!merchant?.trim()) {
      return {
        categoryId: null,
        confidence: 0,
        source: "uncategorized",
        explanationCode: "no_merchant",
      };
    }

    const pattern = normalizeMerchant(merchant);

    const [rule] = await this.db
      .select({ categoryId: categoryRules.categoryId })
      .from(categoryRules)
      .where(
        and(
          eq(categoryRules.userId, userId),
          eq(categoryRules.pattern, pattern),
          eq(categoryRules.active, true),
        ),
      );

    if (rule) {
      return {
        categoryId: rule.categoryId,
        confidence: 100,
        source: "user_rule",
        explanationCode: "matched_personal_rule",
      };
    }

    const [historical] = await this.db
      .select({ categoryId: transactions.categoryId })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          isNotNull(transactions.categoryId),
          eq(sql`lower(trim(${transactions.merchant}))`, pattern),
        ),
      )
      .orderBy(desc(transactions.occurredAt))
      .limit(1);

    if (historical?.categoryId) {
      return {
        categoryId: historical.categoryId,
        confidence: 75,
        source: "merchant_history",
        explanationCode: "matched_own_history",
      };
    }

    return {
      categoryId: null,
      confidence: 0,
      source: "uncategorized",
      explanationCode: "no_match",
    };
  }

  /**
   * Turns a manual correction into a durable personal rule — the mechanism that makes
   * manual work shrink month over month ("всегда относить X к категории Y").
   */
  async learnFromCorrection(
    userId: string,
    merchant: string | null | undefined,
    categoryId: string,
  ): Promise<void> {
    if (!merchant?.trim()) return;
    const pattern = normalizeMerchant(merchant);

    await this.db
      .insert(categoryRules)
      .values({ userId, pattern, categoryId })
      .onConflictDoUpdate({
        target: [categoryRules.userId, categoryRules.pattern],
        set: { categoryId, active: true, updatedAt: new Date() },
      });
  }
}
