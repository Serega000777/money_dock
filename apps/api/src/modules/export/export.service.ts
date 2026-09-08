import { Inject, Injectable } from "@nestjs/common";
import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";

import { AuditLogService } from "../../common/audit-log.service";
import type { Database } from "../../db/client";
import { DATABASE } from "../../db/database.token";
import { categoryRules, notes, reviewItems, transactionSplits, transactions } from "../../db/schema";
import { AccountsService } from "../accounts/accounts.service";
import { CategoriesService } from "../categories/categories.service";
import { EntitlementsService } from "../entitlements/entitlements.service";
import { UsersService } from "../users/users.service";

/**
 * Everything the user has ever entered, as one JSON payload (spec §34: "Экспорт
 * выгружает пользовательские данные"). Synchronous — MVP data volumes don't justify a
 * queue/S3 job for this yet (ADR 0007: no speculative infrastructure).
 */
@Injectable()
export class ExportService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly users: UsersService,
    private readonly accounts: AccountsService,
    private readonly categories: CategoriesService,
    private readonly entitlements: EntitlementsService,
    private readonly auditLog: AuditLogService,
  ) {}

  async exportAll(userId: string) {
    const [user, accountList, categoryList, plan, txRows, reviewRows, ruleRows, noteRows] =
      await Promise.all([
        this.users.getById(userId),
        this.accounts.list(userId),
        this.categories.listForUser(userId),
        this.entitlements.getPlan(userId),
        this.db
          .select()
          .from(transactions)
          .where(and(eq(transactions.userId, userId), isNull(transactions.deletedAt)))
          .orderBy(asc(transactions.occurredAt)),
        this.db
          .select()
          .from(reviewItems)
          .where(eq(reviewItems.userId, userId))
          .orderBy(desc(reviewItems.createdAt)),
        this.db.select().from(categoryRules).where(eq(categoryRules.userId, userId)),
        this.db.select().from(notes).where(eq(notes.userId, userId)).orderBy(desc(notes.updatedAt)),
      ]);

    const splitRows = txRows.length
      ? await this.db
          .select()
          .from(transactionSplits)
          .where(
            inArray(
              transactionSplits.transactionId,
              txRows.map((row) => row.id),
            ),
          )
      : [];
    const splitsByTransaction = new Map<string, typeof splitRows>();
    for (const split of splitRows) {
      const list = splitsByTransaction.get(split.transactionId) ?? [];
      list.push(split);
      splitsByTransaction.set(split.transactionId, list);
    }

    await this.auditLog.record({
      userId,
      action: "data.export",
      entityType: "user",
      entityId: userId,
      metadata: { transactionCount: txRows.length },
    });

    return {
      exportedAt: new Date().toISOString(),
      user,
      plan,
      accounts: accountList,
      categories: categoryList,
      transactions: txRows.map((row) => ({
        id: row.id,
        accountId: row.accountId,
        categoryId: row.categoryId,
        type: row.type,
        amountMinor: row.amountMinor,
        currency: row.currency,
        occurredAt: row.occurredAt.toISOString(),
        merchant: row.merchant,
        note: row.note,
        source: row.source,
        status: row.status,
        splits: (splitsByTransaction.get(row.id) ?? []).map((split) => ({
          categoryId: split.categoryId,
          amountMinor: split.amountMinor,
        })),
      })),
      reviewItems: reviewRows.map((row) => ({
        id: row.id,
        transactionId: row.transactionId,
        reason: row.reason,
        confidence: row.confidence,
        status: row.status,
        createdAt: row.createdAt.toISOString(),
        resolvedAt: row.resolvedAt?.toISOString() ?? null,
      })),
      categoryRules: ruleRows.map((row) => ({
        pattern: row.pattern,
        categoryId: row.categoryId,
        active: row.active,
      })),
      notes: noteRows.map((row) => ({
        id: row.id,
        title: row.title,
        body: row.body,
        colorIndex: row.colorIndex,
        pinned: row.pinned,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      })),
    };
  }
}
