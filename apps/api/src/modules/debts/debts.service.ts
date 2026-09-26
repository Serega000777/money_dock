import { asMinorUnits, type Debt } from "@money-dock/shared-types";
import type { CreateDebtInput, UpdateDebtInput } from "@money-dock/validation";
import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, asc, eq } from "drizzle-orm";

import type { Database } from "../../db/client";
import { DATABASE } from "../../db/database.token";
import { firstOrThrow } from "../../db/first-or-throw";
import { debts } from "../../db/schema";

type DebtRow = typeof debts.$inferSelect;

function toDebt(row: DebtRow): Debt {
  return {
    id: row.id,
    direction: row.direction,
    counterpartyName: row.counterpartyName,
    amountMinor: asMinorUnits(row.amountMinor),
    currency: row.currency as Debt["currency"],
    note: row.note,
    dueDate: row.dueDate?.toISOString() ?? null,
    settledAt: row.settledAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

@Injectable()
export class DebtsService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  /** Open debts first (earliest due date first, undated last), settled ones trail at
   * the bottom — the list reads as "what's outstanding", not a plain history. */
  async list(userId: string): Promise<Debt[]> {
    const rows = await this.db
      .select()
      .from(debts)
      .where(eq(debts.userId, userId))
      .orderBy(asc(debts.settledAt), asc(debts.dueDate), asc(debts.createdAt));
    return rows.map(toDebt);
  }

  async create(userId: string, input: CreateDebtInput): Promise<Debt> {
    const rows = await this.db
      .insert(debts)
      .values({
        userId,
        direction: input.direction,
        counterpartyName: input.counterpartyName,
        amountMinor: input.amountMinor,
        currency: input.currency,
        note: input.note ?? null,
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
      })
      .returning();
    return toDebt(firstOrThrow(rows));
  }

  async update(userId: string, id: string, input: UpdateDebtInput): Promise<Debt> {
    const updated = await this.db
      .update(debts)
      .set({
        ...(input.direction !== undefined ? { direction: input.direction } : {}),
        ...(input.counterpartyName !== undefined
          ? { counterpartyName: input.counterpartyName }
          : {}),
        ...(input.amountMinor !== undefined ? { amountMinor: input.amountMinor } : {}),
        ...(input.currency !== undefined ? { currency: input.currency } : {}),
        ...(input.note !== undefined ? { note: input.note } : {}),
        ...(input.dueDate !== undefined
          ? { dueDate: input.dueDate ? new Date(input.dueDate) : null }
          : {}),
      })
      .where(and(eq(debts.id, id), eq(debts.userId, userId)))
      .returning();
    if (updated.length === 0) throw new NotFoundException("Debt not found");
    return toDebt(firstOrThrow(updated));
  }

  async setSettled(userId: string, id: string, settled: boolean): Promise<Debt> {
    const updated = await this.db
      .update(debts)
      .set({ settledAt: settled ? new Date() : null })
      .where(and(eq(debts.id, id), eq(debts.userId, userId)))
      .returning();
    if (updated.length === 0) throw new NotFoundException("Debt not found");
    return toDebt(firstOrThrow(updated));
  }

  async remove(userId: string, id: string): Promise<void> {
    const deleted = await this.db
      .delete(debts)
      .where(and(eq(debts.id, id), eq(debts.userId, userId)))
      .returning({ id: debts.id });
    if (deleted.length === 0) throw new NotFoundException("Debt not found");
  }
}
