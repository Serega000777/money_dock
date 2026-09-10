import { asMinorUnits, type RecurringPayment, type Transaction } from "@money-dock/shared-types";
import type { CreateRecurringPaymentInput } from "@money-dock/validation";
import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, asc, eq } from "drizzle-orm";

import type { Database } from "../../db/client";
import { DATABASE } from "../../db/database.token";
import { firstOrThrow } from "../../db/first-or-throw";
import { recurringPayments } from "../../db/schema";
import { AccountsService } from "../accounts/accounts.service";
import { TransactionsService } from "../transactions/transactions.service";

type RecurringPaymentRow = typeof recurringPayments.$inferSelect;

function toRecurringPayment(row: RecurringPaymentRow): RecurringPayment {
  return {
    id: row.id,
    accountId: row.accountId,
    categoryId: row.categoryId,
    name: row.name,
    amountMinor: asMinorUnits(row.amountMinor),
    currency: row.currency as RecurringPayment["currency"],
    dueDay: row.dueDay,
    reminderDaysBefore: row.reminderDaysBefore,
    lastPaidAt: row.lastPaidAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

@Injectable()
export class RecurringPaymentsService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly accountsService: AccountsService,
    private readonly transactionsService: TransactionsService,
  ) {}

  /** Undated ones (dueDay null) last; among dated ones, earliest day of month first. */
  async list(userId: string): Promise<RecurringPayment[]> {
    const rows = await this.db
      .select()
      .from(recurringPayments)
      .where(eq(recurringPayments.userId, userId))
      .orderBy(asc(recurringPayments.dueDay));
    return rows.map(toRecurringPayment);
  }

  async create(userId: string, input: CreateRecurringPaymentInput): Promise<RecurringPayment> {
    await this.accountsService.getOwned(userId, input.accountId);
    const rows = await this.db
      .insert(recurringPayments)
      .values({ ...input, userId })
      .returning();
    return toRecurringPayment(firstOrThrow(rows));
  }

  async remove(userId: string, id: string): Promise<void> {
    const deleted = await this.db
      .delete(recurringPayments)
      .where(and(eq(recurringPayments.id, id), eq(recurringPayments.userId, userId)))
      .returning({ id: recurringPayments.id });
    if (deleted.length === 0) throw new NotFoundException("Recurring payment not found");
  }

  /** Logs today's payment as a real transaction and stamps `lastPaidAt` — being monthly
   * and calendar-anchored (`dueDay`), there's no date to roll forward like a
   * week/year interval would need; next month's due day is already implied. */
  async pay(userId: string, id: string): Promise<{ payment: RecurringPayment; transaction: Transaction }> {
    const [row] = await this.db
      .select()
      .from(recurringPayments)
      .where(and(eq(recurringPayments.id, id), eq(recurringPayments.userId, userId)));
    if (!row) throw new NotFoundException("Recurring payment not found");

    const transaction = await this.transactionsService.create(userId, {
      type: "expense",
      accountId: row.accountId,
      categoryId: row.categoryId ?? undefined,
      amountMinor: row.amountMinor,
      currency: row.currency as Transaction["currency"],
      merchant: row.name,
      clientId: crypto.randomUUID(),
    });

    const updated = await this.db
      .update(recurringPayments)
      .set({ lastPaidAt: new Date() })
      .where(eq(recurringPayments.id, id))
      .returning();

    return { payment: toRecurringPayment(firstOrThrow(updated)), transaction };
  }
}
