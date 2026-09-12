import { asMinorUnits, type SavingsGoal } from "@money-dock/shared-types";
import type { ContributeGoalInput, CreateGoalInput } from "@money-dock/validation";
import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, asc, eq, sql } from "drizzle-orm";

import type { Database } from "../../db/client";
import { DATABASE } from "../../db/database.token";
import { firstOrThrow } from "../../db/first-or-throw";
import { savingsGoals } from "../../db/schema";

type GoalRow = typeof savingsGoals.$inferSelect;

function toGoal(row: GoalRow): SavingsGoal {
  return {
    id: row.id,
    name: row.name,
    icon: row.icon,
    targetMinor: asMinorUnits(row.targetMinor),
    savedMinor: asMinorUnits(row.savedMinor),
    currency: row.currency as SavingsGoal["currency"],
    deadline: row.deadline,
    createdAt: row.createdAt.toISOString(),
  };
}

@Injectable()
export class GoalsService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async list(userId: string): Promise<SavingsGoal[]> {
    const rows = await this.db
      .select()
      .from(savingsGoals)
      .where(eq(savingsGoals.userId, userId))
      .orderBy(asc(savingsGoals.createdAt));
    return rows.map(toGoal);
  }

  async create(userId: string, input: CreateGoalInput): Promise<SavingsGoal> {
    const rows = await this.db
      .insert(savingsGoals)
      .values({ ...input, userId })
      .returning();
    return toGoal(firstOrThrow(rows));
  }

  /** Adds (or, for a negative amount, takes back) earmarked money. Never goes below zero —
   * "taking back more than was put aside" is a typo, not an intent. */
  async contribute(userId: string, id: string, input: ContributeGoalInput): Promise<SavingsGoal> {
    const current = await this.getOwned(userId, id);
    if (current.savedMinor + input.amountMinor < 0) {
      throw new BadRequestException("Нельзя снять больше, чем отложено");
    }
    const rows = await this.db
      .update(savingsGoals)
      .set({
        savedMinor: sql`${savingsGoals.savedMinor} + ${input.amountMinor}`,
        updatedAt: new Date(),
      })
      .where(and(eq(savingsGoals.id, id), eq(savingsGoals.userId, userId)))
      .returning();
    return toGoal(firstOrThrow(rows));
  }

  async remove(userId: string, id: string): Promise<void> {
    const deleted = await this.db
      .delete(savingsGoals)
      .where(and(eq(savingsGoals.id, id), eq(savingsGoals.userId, userId)))
      .returning({ id: savingsGoals.id });
    if (deleted.length === 0) throw new NotFoundException("Goal not found");
  }

  private async getOwned(userId: string, id: string): Promise<GoalRow> {
    const [row] = await this.db
      .select()
      .from(savingsGoals)
      .where(and(eq(savingsGoals.id, id), eq(savingsGoals.userId, userId)));
    if (!row) throw new NotFoundException("Goal not found");
    return row;
  }
}
