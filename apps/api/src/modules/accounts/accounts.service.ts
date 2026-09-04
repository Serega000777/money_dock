import type { Account } from "@money-dock/shared-types";
import { asMinorUnits } from "@money-dock/shared-types";
import type { CreateAccountInput, UpdateAccountInput } from "@money-dock/validation";
import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, eq, isNull } from "drizzle-orm";

import type { Database } from "../../db/client";
import { DATABASE } from "../../db/database.token";
import { firstOrThrow } from "../../db/first-or-throw";
import { accounts } from "../../db/schema";

function toAccount(row: typeof accounts.$inferSelect): Account {
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    currency: row.currency as Account["currency"],
    initialBalanceMinor: asMinorUnits(row.initialBalanceMinor),
    archivedAt: row.archivedAt?.toISOString() ?? null,
  };
}

@Injectable()
export class AccountsService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async list(userId: string): Promise<Account[]> {
    const rows = await this.db
      .select()
      .from(accounts)
      .where(and(eq(accounts.userId, userId), isNull(accounts.archivedAt)));
    return rows.map(toAccount);
  }

  async create(userId: string, input: CreateAccountInput): Promise<Account> {
    const rows = await this.db
      .insert(accounts)
      .values({ ...input, userId })
      .returning();
    return toAccount(firstOrThrow(rows));
  }

  /** Scoped by (id, userId) so one user can never read or touch another user's account. */
  async getOwned(userId: string, id: string): Promise<Account> {
    const [row] = await this.db
      .select()
      .from(accounts)
      .where(and(eq(accounts.id, id), eq(accounts.userId, userId)));
    if (!row) throw new NotFoundException("Account not found");
    return toAccount(row);
  }

  async update(userId: string, id: string, input: UpdateAccountInput): Promise<Account> {
    await this.getOwned(userId, id);
    const rows = await this.db
      .update(accounts)
      .set({ ...input, updatedAt: new Date() })
      .where(and(eq(accounts.id, id), eq(accounts.userId, userId)))
      .returning();
    return toAccount(firstOrThrow(rows));
  }

  async archive(userId: string, id: string): Promise<void> {
    await this.getOwned(userId, id);
    await this.db
      .update(accounts)
      .set({ archivedAt: new Date() })
      .where(and(eq(accounts.id, id), eq(accounts.userId, userId)));
  }
}
