import type { Account } from "@money-dock/shared-types";
import { asMinorUnits } from "@money-dock/shared-types";
import type { CreateAccountInput, UpdateAccountInput } from "@money-dock/validation";
import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, eq, isNull, sql } from "drizzle-orm";

import type { Database } from "../../db/client";
import { DATABASE } from "../../db/database.token";
import { firstOrThrow } from "../../db/first-or-throw";
import { accounts, transactions } from "../../db/schema";

// Signed net effect of every transaction on its account, computed in SQL rather than
// pulled row-by-row into Node — cheap even as transaction history grows.
// postgres-js returns bigint/numeric aggregate results as strings (to avoid silent
// precision loss); .mapWith(Number) is what actually converts it back for us — unlike a
// plain bigint("...", { mode: "number" }) column, a raw sql<T> tag gets no such mapping
// for free.
const netMovement = sql<number>`coalesce(sum(case
  when ${transactions.type} = 'income' then ${transactions.amountMinor}
  when ${transactions.type} = 'expense' then -${transactions.amountMinor}
  when ${transactions.type} = 'transfer' and ${transactions.transferDirection} = 'out' then -${transactions.amountMinor}
  when ${transactions.type} = 'transfer' and ${transactions.transferDirection} = 'in' then ${transactions.amountMinor}
  else 0
end), 0)`.mapWith(Number);

function toAccount(row: typeof accounts.$inferSelect, net: number): Account {
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    currency: row.currency as Account["currency"],
    initialBalanceMinor: asMinorUnits(row.initialBalanceMinor),
    currentBalanceMinor: asMinorUnits(row.initialBalanceMinor + net),
    archivedAt: row.archivedAt?.toISOString() ?? null,
  };
}

@Injectable()
export class AccountsService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async list(userId: string): Promise<Account[]> {
    const rows = await this.db
      .select({ account: accounts, net: netMovement })
      .from(accounts)
      .leftJoin(
        transactions,
        and(eq(transactions.accountId, accounts.id), isNull(transactions.deletedAt)),
      )
      .where(and(eq(accounts.userId, userId), isNull(accounts.archivedAt)))
      .groupBy(accounts.id);
    return rows.map(({ account, net }) => toAccount(account, net));
  }

  async create(userId: string, input: CreateAccountInput): Promise<Account> {
    const rows = await this.db
      .insert(accounts)
      .values({ ...input, userId })
      .returning();
    return toAccount(firstOrThrow(rows), 0);
  }

  /** Scoped by (id, userId) so one user can never read or touch another user's account. */
  async getOwned(userId: string, id: string): Promise<Account> {
    const [row] = await this.db
      .select()
      .from(accounts)
      .where(and(eq(accounts.id, id), eq(accounts.userId, userId)));
    if (!row) throw new NotFoundException("Account not found");
    return toAccount(row, await this.netMovementFor(id));
  }

  async update(userId: string, id: string, input: UpdateAccountInput): Promise<Account> {
    await this.getOwned(userId, id);
    const rows = await this.db
      .update(accounts)
      .set({ ...input, updatedAt: new Date() })
      .where(and(eq(accounts.id, id), eq(accounts.userId, userId)))
      .returning();
    return toAccount(firstOrThrow(rows), await this.netMovementFor(id));
  }

  async archive(userId: string, id: string): Promise<void> {
    await this.getOwned(userId, id);
    await this.db
      .update(accounts)
      .set({ archivedAt: new Date() })
      .where(and(eq(accounts.id, id), eq(accounts.userId, userId)));
  }

  private async netMovementFor(accountId: string): Promise<number> {
    const [row] = await this.db
      .select({ net: netMovement })
      .from(transactions)
      .where(and(eq(transactions.accountId, accountId), isNull(transactions.deletedAt)));
    return row?.net ?? 0;
  }
}
