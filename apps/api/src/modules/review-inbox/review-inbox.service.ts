import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, desc, eq, isNull } from "drizzle-orm";

import type { Database } from "../../db/client";
import { DATABASE } from "../../db/database.token";
import { auditLogs, reviewItems, transactions } from "../../db/schema";
import { CategorizationService } from "../categorization/categorization.service";

export interface ReviewInboxItem {
  id: string;
  reason: (typeof reviewItems.$inferSelect)["reason"];
  confidence: number | null;
  createdAt: string;
  transaction: {
    id: string;
    amountMinor: number;
    currency: string;
    merchant: string | null;
    occurredAt: string;
    categoryId: string | null;
  };
  suggestion: {
    duplicateOfTransactionId?: string;
    categoryId?: string;
    merchant?: string;
  } | null;
}

export type ReviewAction = "categorize" | "confirm_duplicate" | "not_duplicate" | "dismiss";

@Injectable()
export class ReviewInboxService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly categorization: CategorizationService,
  ) {}

  async listPending(userId: string): Promise<ReviewInboxItem[]> {
    const rows = await this.db
      .select({ item: reviewItems, transaction: transactions })
      .from(reviewItems)
      .innerJoin(transactions, eq(transactions.id, reviewItems.transactionId))
      .where(
        and(
          eq(reviewItems.userId, userId),
          eq(reviewItems.status, "pending"),
          isNull(transactions.deletedAt),
        ),
      )
      .orderBy(desc(reviewItems.createdAt));

    return rows.map(({ item, transaction }) => ({
      id: item.id,
      reason: item.reason,
      confidence: item.confidence,
      createdAt: item.createdAt.toISOString(),
      transaction: {
        id: transaction.id,
        amountMinor: transaction.amountMinor,
        currency: transaction.currency,
        merchant: transaction.merchant,
        occurredAt: transaction.occurredAt.toISOString(),
        categoryId: transaction.categoryId,
      },
      suggestion: item.suggestedJson ?? null,
    }));
  }

  /**
   * Applies the user's decision and records it. Every branch writes an audit entry —
   * the point of this screen is that uncertainty is handled visibly, not silently.
   */
  async resolve(
    userId: string,
    itemId: string,
    action: ReviewAction,
    categoryId?: string,
  ): Promise<void> {
    const [item] = await this.db
      .select()
      .from(reviewItems)
      .where(and(eq(reviewItems.id, itemId), eq(reviewItems.userId, userId)));
    if (!item) throw new NotFoundException("Элемент проверки не найден");
    if (item.status !== "pending") throw new BadRequestException("Этот элемент уже обработан");

    switch (action) {
      case "categorize": {
        if (!categoryId) throw new BadRequestException("Нужно указать категорию");
        const [transaction] = await this.db
          .select({ merchant: transactions.merchant })
          .from(transactions)
          .where(and(eq(transactions.id, item.transactionId), eq(transactions.userId, userId)));

        await this.db
          .update(transactions)
          .set({ categoryId, status: "confirmed", updatedAt: new Date() })
          .where(and(eq(transactions.id, item.transactionId), eq(transactions.userId, userId)));

        // The correction becomes a rule, so the same merchant won't come back here.
        await this.categorization.learnFromCorrection(userId, transaction?.merchant, categoryId);
        break;
      }

      case "confirm_duplicate": {
        // Soft delete (spec §13) — the row stays for undo/audit, not gone from disk.
        await this.db
          .update(transactions)
          .set({ deletedAt: new Date() })
          .where(and(eq(transactions.id, item.transactionId), eq(transactions.userId, userId)));
        break;
      }

      case "not_duplicate": {
        await this.db
          .update(transactions)
          .set({ status: "confirmed", updatedAt: new Date() })
          .where(and(eq(transactions.id, item.transactionId), eq(transactions.userId, userId)));
        break;
      }

      case "dismiss":
        break;
    }

    await this.db
      .update(reviewItems)
      .set({ status: action === "dismiss" ? "dismissed" : "resolved", resolvedAt: new Date() })
      .where(eq(reviewItems.id, item.id));

    await this.db.insert(auditLogs).values({
      userId,
      action: `review.${action}`,
      entityType: "review_item",
      entityId: item.id,
      metadata: { reason: item.reason, transactionId: item.transactionId, categoryId },
    });
  }
}
