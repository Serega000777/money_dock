import { classifyByKeyword, mccToSystemCategory, normalizeMerchant } from "@money-dock/business-rules";
import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";

import type { Database } from "../../db/client";
import { DATABASE } from "../../db/database.token";
import { categories, categoryRules, merchantAliases, transactions } from "../../db/schema";

export type CategorizationSource =
  | "user_rule"
  | "merchant_history"
  | "global_alias"
  | "mcc"
  | "local_classifier"
  | "uncategorized";

export interface CategorizationResult {
  categoryId: string | null;
  /** 0-100. Anything below the review bar lands in the Review Inbox. */
  confidence: number;
  source: CategorizationSource;
  explanationCode: string;
}

/** Below this, the transaction goes to the Review Inbox instead of being trusted. */
export const REVIEW_CONFIDENCE_THRESHOLD = 60;

const UNCATEGORIZED: CategorizationResult = {
  categoryId: null,
  confidence: 0,
  source: "uncategorized",
  explanationCode: "no_match",
};

/**
 * Priority order (spec §18): personal rule → the user's own history for this merchant →
 * global merchant alias → MCC → local (keyword) classifier → uncategorized/review. An
 * LLM fallback slot exists in the spec between the classifier and uncategorized but is
 * deliberately not wired here yet — every step above it is enough signal on its own, and
 * adding a network call is a separate decision (cost, latency, what data it may see).
 */
@Injectable()
export class CategorizationService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async categorize(
    userId: string,
    merchant: string | null | undefined,
    mcc?: string | null,
  ): Promise<CategorizationResult> {
    if (!merchant?.trim()) {
      return { ...UNCATEGORIZED, explanationCode: "no_merchant" };
    }

    const pattern = normalizeMerchant(merchant);

    const byRule = await this.matchUserRule(userId, pattern);
    if (byRule) return byRule;

    const byHistory = await this.matchUserHistory(userId, pattern);
    if (byHistory) return byHistory;

    const byAlias = await this.matchGlobalAlias(pattern);
    if (byAlias) return byAlias;

    if (mcc) {
      const byMcc = await this.matchMcc(mcc);
      if (byMcc) return byMcc;
    }

    const byKeyword = await this.matchLocalClassifier(merchant);
    if (byKeyword) return byKeyword;

    return UNCATEGORIZED;
  }

  private async matchUserRule(
    userId: string,
    pattern: string,
  ): Promise<CategorizationResult | null> {
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
    if (!rule) return null;
    return {
      categoryId: rule.categoryId,
      confidence: 100,
      source: "user_rule",
      explanationCode: "matched_personal_rule",
    };
  }

  private async matchUserHistory(
    userId: string,
    pattern: string,
  ): Promise<CategorizationResult | null> {
    const [historical] = await this.db
      .select({ categoryId: transactions.categoryId })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          isNull(transactions.deletedAt),
          isNotNull(transactions.categoryId),
          eq(sql`lower(trim(${transactions.merchant}))`, pattern),
        ),
      )
      .orderBy(desc(transactions.occurredAt))
      .limit(1);
    if (!historical?.categoryId) return null;
    return {
      categoryId: historical.categoryId,
      confidence: 75,
      source: "merchant_history",
      explanationCode: "matched_own_history",
    };
  }

  /** Curated brand-name lookup (spec: `merchant_aliases`), shared across all users. The
   * table is small, so matching in JS is simpler than a fragile SQL LIKE per alias. */
  private async matchGlobalAlias(pattern: string): Promise<CategorizationResult | null> {
    const aliases = await this.db
      .select({ rawPattern: merchantAliases.rawPattern, categoryId: merchantAliases.defaultCategoryId })
      .from(merchantAliases);
    const match = aliases.find((alias) => pattern.includes(alias.rawPattern));
    if (!match?.categoryId) return null;
    return {
      categoryId: match.categoryId,
      confidence: 70,
      source: "global_alias",
      explanationCode: "matched_global_alias",
    };
  }

  private async matchMcc(mcc: string): Promise<CategorizationResult | null> {
    const systemCode = mccToSystemCategory(mcc);
    if (!systemCode) return null;
    const categoryId = await this.systemCategoryId(systemCode);
    if (!categoryId) return null;
    // Below REVIEW_CONFIDENCE_THRESHOLD on purpose: a bank's MCC is often generic
    // (e.g. one code covering an entire supermarket chain's non-food aisle too).
    return { categoryId, confidence: 55, source: "mcc", explanationCode: `matched_mcc_${mcc}` };
  }

  private async matchLocalClassifier(merchant: string): Promise<CategorizationResult | null> {
    const systemCode = classifyByKeyword(merchant);
    if (!systemCode) return null;
    const categoryId = await this.systemCategoryId(systemCode);
    if (!categoryId) return null;
    // The weakest signal in the pipeline — always below the review bar.
    return {
      categoryId,
      confidence: 40,
      source: "local_classifier",
      explanationCode: "matched_keyword",
    };
  }

  private async systemCategoryId(systemCode: string): Promise<string | null> {
    const [row] = await this.db
      .select({ id: categories.id })
      .from(categories)
      .where(and(eq(categories.systemCode, systemCode), isNull(categories.userId)));
    return row?.id ?? null;
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
