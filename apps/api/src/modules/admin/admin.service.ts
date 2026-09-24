import type { AdminStats, AdminUserSummary, Plan } from "@money-dock/shared-types";
import type { GrantSubscriptionInput, SearchUsersInput } from "@money-dock/validation";
import { Inject, Injectable } from "@nestjs/common";
import { and, count, desc, eq, gte, ilike, inArray, isNull, sql } from "drizzle-orm";

import type { Database } from "../../db/client";
import { DATABASE } from "../../db/database.token";
import { accounts, starsPayments, subscriptions, userIdentities, users } from "../../db/schema";
import { EntitlementsService } from "../entitlements/entitlements.service";

const DAY_MS = 24 * 60 * 60 * 1000;
const SIGNUP_TREND_DAYS = 14;

@Injectable()
export class AdminService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly entitlements: EntitlementsService,
  ) {}

  async getStats(): Promise<AdminStats> {
    const now = Date.now();
    const trendStart = new Date(now - (SIGNUP_TREND_DAYS - 1) * DAY_MS);
    trendStart.setUTCHours(0, 0, 0, 0);

    const [
      [totalUsers],
      [activeToday],
      [activeLast30Days],
      [totalAccounts],
      planRows,
      [starsTotal],
      [starsLast30Days],
      recentSignups,
    ] = await Promise.all([
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
      // Raw stored plan, same definition AdminUserSummary.plan uses — a missing
      // subscription row (left join) counts as "free", not "unknown".
      this.db
        .select({ plan: subscriptions.plan, value: count() })
        .from(users)
        .leftJoin(subscriptions, eq(subscriptions.userId, users.id))
        .groupBy(subscriptions.plan),
      this.db
        .select({ value: sql<number>`coalesce(sum(${starsPayments.amount}), 0)::int` })
        .from(starsPayments),
      this.db
        .select({ value: sql<number>`coalesce(sum(${starsPayments.amount}), 0)::int` })
        .from(starsPayments)
        .where(gte(starsPayments.createdAt, new Date(now - 30 * DAY_MS))),
      this.db.select({ createdAt: users.createdAt }).from(users).where(gte(users.createdAt, trendStart)),
    ]);

    const planBreakdown: Record<Plan, number> = { free: 0, pro: 0, pro_bank: 0 };
    for (const row of planRows) planBreakdown[row.plan ?? "free"] += row.value;

    // Bucket by UTC calendar day so every one of the last 14 days shows up even with zero
    // signups — a gap in the trend line is as informative as the bars either side of it.
    const byDay = new Map<string, number>();
    for (let i = 0; i < SIGNUP_TREND_DAYS; i++) {
      byDay.set(new Date(trendStart.getTime() + i * DAY_MS).toISOString().slice(0, 10), 0);
    }
    for (const row of recentSignups) {
      const key = row.createdAt.toISOString().slice(0, 10);
      byDay.set(key, (byDay.get(key) ?? 0) + 1);
    }

    return {
      totalUsers: totalUsers?.value ?? 0,
      activeToday: activeToday?.value ?? 0,
      activeLast30Days: activeLast30Days?.value ?? 0,
      totalAccounts: totalAccounts?.value ?? 0,
      planBreakdown,
      starsRevenue: { total: starsTotal?.value ?? 0, last30Days: starsLast30Days?.value ?? 0 },
      signupsByDay: [...byDay.entries()].map(([date, count]) => ({ date, count })),
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
