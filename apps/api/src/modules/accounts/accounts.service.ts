import { createHash, randomBytes } from "node:crypto";

import type { Account, AccountInvitePreview, AccountMember, AccountRole } from "@money-dock/shared-types";
import { asMinorUnits } from "@money-dock/shared-types";
import type { CreateAccountInput, CreateAccountInviteInput, UpdateAccountInput } from "@money-dock/validation";
import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, eq, isNull, ne, or, sql } from "drizzle-orm";

import type { Database } from "../../db/client";
import { DATABASE } from "../../db/database.token";
import { firstOrThrow } from "../../db/first-or-throw";
import { accountInvites, accountMembers, accounts, transactions, users } from "../../db/schema";
import { EntitlementsService } from "../entitlements/entitlements.service";

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

function toAccount(row: typeof accounts.$inferSelect, net: number, role: AccountRole): Account {
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    currency: row.currency as Account["currency"],
    initialBalanceMinor: asMinorUnits(row.initialBalanceMinor),
    currentBalanceMinor: asMinorUnits(row.initialBalanceMinor + net),
    bank: row.bank,
    cardLast4: row.cardLast4,
    archivedAt: row.archivedAt?.toISOString() ?? null,
    role,
  };
}

@Injectable()
export class AccountsService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly entitlements: EntitlementsService,
  ) {}

  async list(userId: string): Promise<Account[]> {
    const rows = await this.db
      .select({ account: accounts, role: accountMembers.role, net: netMovement })
      .from(accountMembers)
      .innerJoin(accounts, eq(accountMembers.accountId, accounts.id))
      .leftJoin(
        transactions,
        and(eq(transactions.accountId, accounts.id), isNull(transactions.deletedAt)),
      )
      .where(and(eq(accountMembers.userId, userId), isNull(accounts.archivedAt)))
      .groupBy(accounts.id, accountMembers.role);
    return rows.map(({ account, role, net }) => toAccount(account, net, role));
  }

  /** Every account id this user can currently see, with none of `list()`'s per-account
   * balance aggregation — for callers (transaction history, analytics, categorization
   * history) that only need to scope a query, not render a balance. `includeArchived`
   * matters for anything reading *history*: archiving is a soft delete (see `archive()`),
   * so an archived account's past transactions must stay visible to whoever could see
   * them before — only `list()` (the accounts screen) should ever drop archived rows. */
  async accessibleAccountIds(userId: string, options?: { includeArchived?: boolean }): Promise<string[]> {
    const conditions = [eq(accountMembers.userId, userId)];
    if (!options?.includeArchived) conditions.push(isNull(accounts.archivedAt));
    const rows = await this.db
      .select({ id: accounts.id })
      .from(accountMembers)
      .innerJoin(accounts, eq(accountMembers.accountId, accounts.id))
      .where(and(...conditions));
    return rows.map((row) => row.id);
  }

  async create(userId: string, input: CreateAccountInput): Promise<Account> {
    // The realistic per-bank card art is a Pro cosmetic — free stays a plain card, never
    // blocked from creating the account itself over it. Checked here, not only in the
    // picker's own lock screen, so the API can't be talked into it directly.
    const canPickBank =
      input.type === "card" && (await this.entitlements.getPlan(userId)) !== "free";
    return this.db.transaction(async (tx) => {
      const rows = await tx.insert(accounts).values({
        ...input,
        userId,
        bank: canPickBank ? (input.bank ?? null) : null,
        cardLast4: canPickBank ? (input.cardLast4 ?? null) : null,
      }).returning();
      const row = firstOrThrow(rows);
      await tx.insert(accountMembers).values({ accountId: row.id, userId, role: "owner", createdByUserId: userId });
      return toAccount(row, 0, "owner");
    });
  }

  /** Scoped by (id, userId) so one user can never read or touch another user's account. */
  async getOwned(userId: string, id: string): Promise<Account> {
    const account = await this.getAccessible(userId, id);
    if (account.role !== "owner") throw new ForbiddenException("Owner access required");
    return account;
  }

  async getWritable(userId: string, id: string): Promise<Account> {
    const account = await this.getAccessible(userId, id);
    if (account.role === "viewer") throw new ForbiddenException("Viewer cannot change this account");
    return account;
  }

  async getAccessible(userId: string, id: string): Promise<Account> {
    const [result] = await this.db.select({ account: accounts, role: accountMembers.role })
      .from(accountMembers).innerJoin(accounts, eq(accountMembers.accountId, accounts.id))
      .where(and(eq(accounts.id, id), eq(accountMembers.userId, userId)));
    if (!result) throw new NotFoundException("Account not found");
    return toAccount(result.account, await this.netMovementFor(id), result.role);
  }

  async update(userId: string, id: string, input: UpdateAccountInput): Promise<Account> {
    await this.getOwned(userId, id);
    const rows = await this.db
      .update(accounts)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(accounts.id, id))
      .returning();
    return toAccount(firstOrThrow(rows), await this.netMovementFor(id), "owner");
  }

  async archive(userId: string, id: string): Promise<void> {
    await this.getOwned(userId, id);
    await this.db
      .update(accounts)
      .set({ archivedAt: new Date() })
      .where(eq(accounts.id, id));
  }

  async members(userId: string, accountId: string): Promise<AccountMember[]> {
    await this.getAccessible(userId, accountId);
    const rows = await this.db.select({ userId: users.id, displayName: users.displayName, role: accountMembers.role, createdAt: accountMembers.createdAt })
      .from(accountMembers).innerJoin(users, eq(accountMembers.userId, users.id))
      .where(eq(accountMembers.accountId, accountId));
    return rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }));
  }

  async createInvite(userId: string, accountId: string, input: CreateAccountInviteInput) {
    await this.getOwned(userId, accountId);
    const token = randomBytes(32).toString("base64url");
    const [invite] = await this.db.insert(accountInvites).values({
      accountId, createdByUserId: userId, role: input.role,
      tokenHash: createHash("sha256").update(token).digest("hex"),
      expiresAt: input.expiresInHours ? new Date(Date.now() + input.expiresInHours * 3_600_000) : null,
      maxUses: input.maxUses,
    }).returning();
    return { id: invite!.id, token, role: invite!.role, expiresAt: invite!.expiresAt?.toISOString() ?? null };
  }

  async invitePreview(token: string): Promise<AccountInvitePreview> {
    const invite = await this.validInvite(token);
    const [row] = await this.db.select({ accountName: accounts.name, inviterName: users.displayName })
      .from(accounts).innerJoin(users, eq(users.id, invite.createdByUserId)).where(eq(accounts.id, invite.accountId));
    if (!row) throw new NotFoundException("Invite not found");
    return { ...row, role: invite.role as "member" | "viewer", expiresAt: invite.expiresAt?.toISOString() ?? null };
  }

  async acceptInvite(userId: string, token: string): Promise<Account> {
    const invite = await this.validInvite(token);
    await this.db.transaction(async (tx) => {
      const [existingMember] = await tx
        .select({ id: accountMembers.id })
        .from(accountMembers)
        .where(and(eq(accountMembers.accountId, invite.accountId), eq(accountMembers.userId, userId)));
      // Already a member (re-tapped the link) — land them on the account without
      // spending another use of the invite.
      if (existingMember) return;

      // The read in validInvite() is only an early rejection; this is what actually
      // enforces maxUses — the WHERE re-checks it inside the same UPDATE, so two
      // concurrent accepts of a maxUses:1 invite can't both slip through the gap
      // between "read usedCount" and "write usedCount".
      const [claimed] = await tx
        .update(accountInvites)
        .set({ usedCount: sql`${accountInvites.usedCount} + 1` })
        .where(
          and(
            eq(accountInvites.id, invite.id),
            isNull(accountInvites.revokedAt),
            or(isNull(accountInvites.maxUses), sql`${accountInvites.usedCount} < ${accountInvites.maxUses}`),
          ),
        )
        .returning({ id: accountInvites.id });
      if (!claimed) throw new BadRequestException("Invite is invalid or expired");

      await tx.insert(accountMembers).values({
        accountId: invite.accountId,
        userId,
        role: invite.role,
        createdByUserId: invite.createdByUserId,
      });
    });
    return this.getAccessible(userId, invite.accountId);
  }

  async revokeInvite(userId: string, accountId: string, inviteId: string): Promise<void> {
    await this.getOwned(userId, accountId);
    await this.db.update(accountInvites).set({ revokedAt: new Date() }).where(and(eq(accountInvites.id, inviteId), eq(accountInvites.accountId, accountId)));
  }

  async updateMember(userId: string, accountId: string, memberId: string, role: AccountRole): Promise<void> {
    await this.getOwned(userId, accountId);
    if (memberId === userId && role !== "owner") await this.assertAnotherOwner(accountId, userId);
    await this.db.update(accountMembers).set({ role }).where(and(eq(accountMembers.accountId, accountId), eq(accountMembers.userId, memberId)));
  }

  async removeMember(userId: string, accountId: string, memberId: string): Promise<void> {
    await this.getOwned(userId, accountId);
    await this.assertAnotherOwner(accountId, memberId);
    await this.db.delete(accountMembers).where(and(eq(accountMembers.accountId, accountId), eq(accountMembers.userId, memberId)));
  }

  private async validInvite(token: string) {
    const hash = createHash("sha256").update(token).digest("hex");
    const [invite] = await this.db.select().from(accountInvites).where(and(eq(accountInvites.tokenHash, hash), isNull(accountInvites.revokedAt)));
    if (!invite || (invite.expiresAt && invite.expiresAt <= new Date()) || (invite.maxUses !== null && invite.usedCount >= invite.maxUses)) {
      throw new BadRequestException("Invite is invalid or expired");
    }
    return invite;
  }

  private async assertAnotherOwner(accountId: string, excludingUserId: string): Promise<void> {
    const [other] = await this.db.select({ id: accountMembers.id }).from(accountMembers)
      .where(and(eq(accountMembers.accountId, accountId), eq(accountMembers.role, "owner"), ne(accountMembers.userId, excludingUserId)));
    if (!other) throw new BadRequestException("Нельзя удалить последнего владельца");
  }

  private async netMovementFor(accountId: string): Promise<number> {
    const [row] = await this.db
      .select({ net: netMovement })
      .from(transactions)
      .where(and(eq(transactions.accountId, accountId), isNull(transactions.deletedAt)));
    return row?.net ?? 0;
  }
}
