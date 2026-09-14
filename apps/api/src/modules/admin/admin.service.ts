import type { AdminStats, AdminUserSummary } from "@money-dock/shared-types";
import type { GrantSubscriptionInput, SearchUsersInput } from "@money-dock/validation";
import { Inject, Injectable } from "@nestjs/common";
import { and, count, desc, eq, gte, ilike, inArray, isNull } from "drizzle-orm";

import type { Database } from "../../db/client";
import { DATABASE } from "../../db/database.token";
import { accounts, subscriptions, userIdentities, users } from "../../db/schema";
import { EntitlementsService } from "../entitlements/entitlements.service";

const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class AdminService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly entitlements: EntitlementsService,
  ) {}

  async getStats(): Promise<AdminStats> {
    const now = Date.now();
    const [[totalUsers], [activeToday], [activeLast30Days], [totalAccounts]] = await Promise.all([
      this.db.select({ value: count() }).from(users),
      this.db
        .select({ value: count() })
        .from(users)
        .where(gte(users.lastActiveAt, new Date(now - DAY_MS))),
      this.db
        .select({ value: count() })
        .from(users)
        .where(gte(users.lastActiveAt, new Date(now - 30 * DAY_MS))),
      this.db.select({ value: count() }).from(accounts).where(isNull(accounts.archivedAt)),
    ]);
    return {
      totalUsers: totalUsers?.value ?? 0,
      activeToday: activeToday?.value ?? 0,
      activeLast30Days: activeLast30Days?.value ?? 0,
      totalAccounts: totalAccounts?.value ?? 0,
    };
  }

  /**
   * By display name (substring) or, if the query is all digits, by the Telegram id
   * linked to the account — the id an admin would actually have on hand (from
   * @userinfobot or ADMIN_TELEGRAM_IDS), not an internal UUID nobody sees. Returns the
   * raw stored plan/expiry, not the expiry-resolved one `EntitlementsService.getPlan`
   * computes elsewhere — an admin looking someone up wants to see "this expired
   * yesterday", not have it silently rewritten to "free".
   */
  async searchUsers(input: SearchUsersInput): Promise<AdminUserSummary[]> {
    let byTelegramId: string[] | null = null;
    if (input.query && /^\d+$/.test(input.query)) {
      const rows = await this.db
        .select({ userId: userIdentities.userId })
        .from(userIdentities)
        .where(
          and(eq(userIdentities.provider, "telegram"), eq(userIdentities.providerUserId, input.query)),
        );
      byTelegramId = rows.map((row) => row.userId);
    }

    const condition = byTelegramId
      ? inArray(users.id, byTelegramId)
      : input.query
        ? ilike(users.displayName, `%${input.query}%`)
        : undefined;

    const rows = await this.db
      .select({
        id: users.id,
        displayName: users.displayName,
        lastActiveAt: users.lastActiveAt,
        createdAt: users.createdAt,
        plan: subscriptions.plan,
        expiresAt: subscriptions.expiresAt,
      })
      .from(users)
      .leftJoin(subscriptions, eq(subscriptions.userId, users.id))
      .where(condition)
      .orderBy(desc(users.createdAt))
      .limit(input.limit);

    return rows.map((row) => ({
      id: row.id,
      displayName: row.displayName,
      plan: row.plan ?? "free",
      planExpiresAt: row.expiresAt?.toISOString() ?? null,
      lastActiveAt: row.lastActiveAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  /** The "gift a subscription" action — no payment involved, just the same hook real
   * billing will call later (`EntitlementsService.setPlan`). */
  async grantSubscription(userId: string, input: GrantSubscriptionInput): Promise<void> {
    const expiresAt = input.days ? new Date(Date.now() + input.days * DAY_MS) : null;
    await this.entitlements.setPlan(userId, input.plan, expiresAt);
  }
}
