import { assertSplitsMatchTotal, SplitSumMismatchError } from "@money-dock/business-rules";
import { asMinorUnits, type Transaction, type TransactionSplit } from "@money-dock/shared-types";
import type {
  CreateTransactionInput,
  CreateTransferInput,
  ListTransactionsQuery,
  UpdateTransactionInput,
} from "@money-dock/validation";
import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";

import { AuditLogService } from "../../common/audit-log.service";
import type { Database } from "../../db/client";
import { DATABASE } from "../../db/database.token";
import { firstOrThrow } from "../../db/first-or-throw";
import { transactionSplits, transactions, transfers, users } from "../../db/schema";
import { AccountsService } from "../accounts/accounts.service";
import { CategorizationService } from "../categorization/categorization.service";

type TransactionRow = typeof transactions.$inferSelect;
type TransactionSourceValue = TransactionRow["source"];
type TransactionStatusValue = TransactionRow["status"];

/** How long after a soft delete the user can still undo it (spec §13: "undo доступен
 * ограниченное время"). Past this, the row is still there for audit but `restore` refuses. */
const UNDO_WINDOW_MS = 5 * 60_000;

function toTransaction(row: TransactionRow, splits: TransactionSplit[] = [], createdByName: string | null = null): Transaction {
  return {
    id: row.id,
    accountId: row.accountId,
    categoryId: row.categoryId,
    type: row.type,
    amountMinor: asMinorUnits(row.amountMinor),
    currency: row.currency as Transaction["currency"],
    occurredAt: row.occurredAt.toISOString(),
    merchant: row.merchant,
    note: row.note,
    source: row.source,
    status: row.status,
    splits,
    createdByUserId: row.userId,
    createdByName,
  };
}

@Injectable()
export class TransactionsService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly accountsService: AccountsService,
    private readonly categorization: CategorizationService,
    private readonly auditLog: AuditLogService,
  ) {}

  accessibleAccounts(userId: string) { return this.accountsService.list(userId); }

  /**
   * `internal` is for server-side callers (statement import) that need to record a
   * different provenance than a hand-typed entry. The HTTP DTO can't set these — the
   * client has no way to claim a transaction came from a bank feed.
   */
  async create(
    userId: string,
    input: CreateTransactionInput,
    internal?: { source?: TransactionSourceValue; status?: TransactionStatusValue },
  ): Promise<Transaction> {
    await this.accountsService.getWritable(userId, input.accountId);

    if (input.splits?.length) {
      try {
        assertSplitsMatchTotal(
          { amountMinor: asMinorUnits(input.amountMinor), currency: input.currency },
          input.splits.map((s) => s.amountMinor),
        );
      } catch (error) {
        if (error instanceof SplitSumMismatchError) throw new BadRequestException(error.message);
        throw error;
      }
    }

    return this.db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(transactions)
        .where(and(eq(transactions.userId, userId), eq(transactions.clientId, input.clientId)));
      if (existing) return toTransaction(existing);

      const row = firstOrThrow(
        await tx
          .insert(transactions)
          .values({
            userId,
            accountId: input.accountId,
            categoryId: input.categoryId,
            type: input.type,
            amountMinor: input.amountMinor,
            currency: input.currency,
            occurredAt: input.occurredAt ? new Date(input.occurredAt) : undefined,
            merchant: input.merchant,
            note: input.note,
            clientId: input.clientId,
            source: internal?.source,
            status: internal?.status,
          })
          .returning(),
      );

      const splits: TransactionSplit[] = (input.splits ?? []).map((s) => ({
        categoryId: s.categoryId,
        amountMinor: asMinorUnits(s.amountMinor),
      }));
      if (splits.length) {
        await tx.insert(transactionSplits).values(
          splits.map((s) => ({
            transactionId: row.id,
            categoryId: s.categoryId,
            amountMinor: s.amountMinor,
          })),
        );
      }

      return toTransaction(row, splits);
    });
  }

  /** Two linked rows, one per account, both idempotent on `${clientId}:out` / `:in`. */
  async createTransfer(userId: string, input: CreateTransferInput): Promise<void> {
    if (input.fromAccountId === input.toAccountId) {
      throw new BadRequestException("Cannot transfer to the same account");
    }
    await this.accountsService.getWritable(userId, input.fromAccountId);
    await this.accountsService.getWritable(userId, input.toAccountId);

    await this.db.transaction(async (tx) => {
      const outClientId = `${input.clientId}:out`;
      const [existing] = await tx
        .select({ id: transactions.id })
        .from(transactions)
        .where(and(eq(transactions.userId, userId), eq(transactions.clientId, outClientId)));
      if (existing) return;

      const shared = {
        userId,
        type: "transfer" as const,
        amountMinor: input.amountMinor,
        currency: input.currency,
        occurredAt: input.occurredAt ? new Date(input.occurredAt) : undefined,
        note: input.note,
      };

      const outgoing = firstOrThrow(
        await tx
          .insert(transactions)
          .values({
            ...shared,
            accountId: input.fromAccountId,
            transferDirection: "out",
            clientId: outClientId,
          })
          .returning(),
      );
      const incoming = firstOrThrow(
        await tx
          .insert(transactions)
          .values({
            ...shared,
            accountId: input.toAccountId,
            transferDirection: "in",
            clientId: `${input.clientId}:in`,
          })
          .returning(),
      );

      await tx.insert(transfers).values({
        outgoingTransactionId: outgoing.id,
        incomingTransactionId: incoming.id,
      });
    });
  }

  async list(userId: string, query: ListTransactionsQuery): Promise<Transaction[]> {
    if (query.accountId) await this.accountsService.getAccessible(userId, query.accountId);
    // includeArchived: archiving an account is a soft delete (see AccountsService.archive)
    // — its past transactions must stay in the history, same as before accounts were
    // ever shared.
    const accessibleIds = await this.accountsService.accessibleAccountIds(userId, { includeArchived: true });
    if (accessibleIds.length === 0) return [];
    const conditions = [isNull(transactions.deletedAt), inArray(transactions.accountId, accessibleIds)];
    if (query.accountId) conditions.push(eq(transactions.accountId, query.accountId));

    const rows = await this.db.select({ transaction: transactions, creatorName: users.displayName })
      .from(transactions).innerJoin(users, eq(users.id, transactions.userId)).where(and(...conditions))
      .orderBy(desc(transactions.occurredAt), desc(transactions.id))
      .limit(query.limit)
      .offset(query.offset);
    return rows.map(({ transaction, creatorName }) => toTransaction(transaction, [], creatorName));
  }

  async getOwned(userId: string, id: string): Promise<Transaction> {
    const [row] = await this.db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.id, id),
          isNull(transactions.deletedAt),
        ),
      );
    if (!row) throw new NotFoundException("Transaction not found");
    await this.accountsService.getAccessible(userId, row.accountId);

    const splits = await this.db
      .select({
        categoryId: transactionSplits.categoryId,
        amountMinor: transactionSplits.amountMinor,
      })
      .from(transactionSplits)
      .where(eq(transactionSplits.transactionId, row.id));

    return toTransaction(
      row,
      splits.map((s) => ({ categoryId: s.categoryId, amountMinor: asMinorUnits(s.amountMinor) })),
    );
  }

  async update(userId: string, id: string, input: UpdateTransactionInput): Promise<Transaction> {
    const before = await this.getOwned(userId, id);
    const access = await this.accountsService.getAccessible(userId, before.accountId);
    if (before.createdByUserId !== userId && access.role !== "owner") throw new ForbiddenException("Only the creator or owner can edit this transaction");
    if (input.accountId) await this.accountsService.getWritable(userId, input.accountId);

    // Both legs of a transfer have to agree on what they are; flipping one to an expense
    // would leave the other pointing at a transaction that no longer matches it.
    if (input.type && input.type !== before.type && before.type === "transfer") {
      throw new BadRequestException("Перевод нельзя превратить в расход или доход");
    }

    // A manual category correction becomes a personal rule, so the next statement with
    // the same merchant lands in the right place without asking again.
    if (input.categoryId && input.categoryId !== before.categoryId) {
      await this.categorization.learnFromCorrection(
        userId,
        input.merchant ?? before.merchant,
        input.categoryId,
      );
    }

    // Access (accessible + creator-or-owner) was already verified above; the row is
    // addressed by id alone from here so an owner editing a co-member's transaction
    // actually updates it instead of matching zero rows.
    const row = firstOrThrow(
      await this.db
        .update(transactions)
        .set({
          ...input,
          occurredAt: input.occurredAt ? new Date(input.occurredAt) : undefined,
          updatedAt: new Date(),
        })
        .where(eq(transactions.id, id))
        .returning(),
    );
    return toTransaction(row);
  }

  /**
   * Soft delete (spec §13): the row stays, `deletedAt` hides it from every read path, and
   * an audit entry records who removed what. Deleting either leg of a transfer removes
   * both — a lone half-transfer isn't meaningful.
   */
  async remove(userId: string, id: string): Promise<void> {
    const transaction = await this.getOwned(userId, id);
    const access = await this.accountsService.getAccessible(userId, transaction.accountId);
    if (transaction.createdByUserId !== userId && access.role !== "owner") {
      throw new ForbiddenException("Only the creator or owner can delete this transaction");
    }
    const deletedAt = new Date();

    const removedIds = await this.db.transaction(async (tx) => {
      const [asOutgoing] = await tx
        .select()
        .from(transfers)
        .where(eq(transfers.outgoingTransactionId, id));
      const [asIncoming] = await tx
        .select()
        .from(transfers)
        .where(eq(transfers.incomingTransactionId, id));
      const pairId = asOutgoing?.incomingTransactionId ?? asIncoming?.outgoingTransactionId;
      const ids = pairId ? [id, pairId] : [id];

      // Access to `id` was just verified above; the paired leg of a transfer lives on
      // the other account of the *same* transfer, which `create()`/`createTransfer()`
      // already required this user to be writable on, so no separate check is needed
      // for it here.
      for (const txId of ids) {
        await tx.update(transactions).set({ deletedAt }).where(eq(transactions.id, txId));
      }
      return ids;
    });

    await this.auditLog.record({
      userId,
      action: "transaction.delete",
      entityType: "transaction",
      entityId: id,
      metadata: { pairedIds: removedIds.filter((txId) => txId !== id) },
    });
  }

  /** Undoes a soft delete within the undo window. Restores both legs of a transfer. */
  async restore(userId: string, id: string): Promise<Transaction> {
    const [row] = await this.db.select().from(transactions).where(eq(transactions.id, id));
    if (!row || !row.deletedAt) throw new NotFoundException("Deleted transaction not found");
    const access = await this.accountsService.getAccessible(userId, row.accountId);
    if (row.userId !== userId && access.role !== "owner") {
      throw new ForbiddenException("Only the creator or owner can restore this transaction");
    }
    if (Date.now() - row.deletedAt.getTime() > UNDO_WINDOW_MS) {
      throw new BadRequestException("Undo window has expired");
    }

    const restoredIds = await this.db.transaction(async (tx) => {
      const [asOutgoing] = await tx
        .select()
        .from(transfers)
        .where(eq(transfers.outgoingTransactionId, id));
      const [asIncoming] = await tx
        .select()
        .from(transfers)
        .where(eq(transfers.incomingTransactionId, id));
      const pairId = asOutgoing?.incomingTransactionId ?? asIncoming?.outgoingTransactionId;
      const ids = pairId ? [id, pairId] : [id];

      for (const txId of ids) {
        await tx.update(transactions).set({ deletedAt: null }).where(eq(transactions.id, txId));
      }
      return ids;
    });

    await this.auditLog.record({
      userId,
      action: "transaction.restore",
      entityType: "transaction",
      entityId: id,
      metadata: { pairedIds: restoredIds.filter((txId) => txId !== id) },
    });

    return this.getOwned(userId, id);
  }
}
