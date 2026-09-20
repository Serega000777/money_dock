import { ForbiddenException, Inject, Injectable } from "@nestjs/common";
import { and, eq, sql } from "drizzle-orm";

import type { Database } from "../../db/client";
import { DATABASE } from "../../db/database.token";
import { starsPayments, subscriptions, usageCounters, users } from "../../db/schema";

export type Plan = "free" | "pro" | "pro_bank";
export type MeteredFeature = "voice" | "import";

/**
 * Free keeps a real habit-forming core and meters only what has a genuine per-use cost
 * (speech recognition) or high time-saving value (statement import) — per the pricing
 * section of the spec. -1 means unlimited.
 */
const MONTHLY_LIMITS: Record<Plan, Record<MeteredFeature, number>> = {
  free: { voice: 10, import: 1 },
  pro: { voice: -1, import: -1 },
  pro_bank: { voice: -1, import: -1 },
};

export interface Entitlements {
  plan: Plan;
  limits: Record<MeteredFeature, number>;
  used: Record<MeteredFeature, number>;
}

@Injectable()
export class EntitlementsService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async hasUser(userId: string): Promise<boolean> {
    const [user] = await this.db.select({ id: users.id }).from(users).where(eq(users.id, userId));
    return Boolean(user);
  }

  async applyStarsPayment(userId: string, chargeId: string, amount: number, days: number) {
    return this.db.transaction(async (tx) => {
      // Serialize distinct payments for the same account, including its first subscription.
      const [user] = await tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).for("update");
      if (!user) throw new Error("Payment account not found");
      const inserted = await tx.insert(starsPayments).values({ userId, chargeId, amount })
        .onConflictDoNothing().returning();
      if (!inserted.length) return null;
      const [current] = await tx.select().from(subscriptions).where(eq(subscriptions.userId, userId));
      const active = current && current.plan !== "free" && (!current.expiresAt || current.expiresAt.getTime() > Date.now());
      const perpetual = active && !current.expiresAt;
      const expiresAt = perpetual ? null : new Date(Math.max(Date.now(), active ? current.expiresAt!.getTime() : 0) + days * 86_400_000);
      const plan = active ? current.plan : "pro";
      await tx.insert(subscriptions).values({ userId, plan, expiresAt }).onConflictDoUpdate({
        target: subscriptions.userId, set: { plan, expiresAt, updatedAt: new Date() },
      });
      return { expiresAt };
    });
  }

  async getPlan(userId: string): Promise<Plan> {
    // The app's one operator (ADMIN_TELEGRAM_IDS, see AuthService) shouldn't have to also
    // gift themselves a subscription to use their own product — admin already implies
    // full access everywhere else (AdminGuard), and there's no real billing yet for them
    // to have paid through in the first place.
    const [account] = await this.db.select({ role: users.role }).from(users).where(eq(users.id, userId));
    if (account?.role === "admin") return "pro_bank";

    const [row] = await this.db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId));

    // An expired paid plan silently behaves as free rather than blocking the user out.
    if (!row) return "free";
    if (row.expiresAt && row.expiresAt.getTime() < Date.now()) return "free";
    return row.plan;
  }

  async getEntitlements(userId: string, periodKey = currentPeriodKey()): Promise<Entitlements> {
    const plan = await this.getPlan(userId);
    const rows = await this.db
      .select({ feature: usageCounters.feature, used: usageCounters.used })
      .from(usageCounters)
      .where(and(eq(usageCounters.userId, userId), eq(usageCounters.periodKey, periodKey)));

    const used: Record<MeteredFeature, number> = { voice: 0, import: 0 };
    for (const row of rows) {
      if (row.feature === "voice" || row.feature === "import") used[row.feature] = row.used;
    }

    return { plan, limits: MONTHLY_LIMITS[plan], used };
  }

  /**
   * Consumes one unit of a metered feature, or throws 403 when the plan is exhausted.
   * The increment is a single atomic upsert, so parallel requests can't overshoot.
   */
  async consume(userId: string, feature: MeteredFeature): Promise<void> {
    const plan = await this.getPlan(userId);
    const limit = MONTHLY_LIMITS[plan][feature];
    if (limit === -1) return;

    const periodKey = currentPeriodKey();
    const [row] = await this.db
      .insert(usageCounters)
      .values({ userId, feature, periodKey, used: 1 })
      .onConflictDoUpdate({
        target: [usageCounters.userId, usageCounters.feature, usageCounters.periodKey],
        set: { used: sql`${usageCounters.used} + 1`, updatedAt: new Date() },
      })
      .returning({ used: usageCounters.used });

    if ((row?.used ?? 0) > limit) {
      throw new ForbiddenException({
        message:
          feature === "voice"
            ? `Бесплатных голосовых операций в этом месяце больше нет (${limit}). Голос входит в Pro.`
            : `Бесплатный импорт в этом месяце уже использован (${limit}). Импорт без ограничений — в Pro.`,
        feature,
        plan,
        limit,
      });
    }
  }

  /** Test/admin hook — real billing arrives with the payment provider. */
  async setPlan(userId: string, plan: Plan, expiresAt: Date | null = null): Promise<void> {
    await this.db
      .insert(subscriptions)
      .values({ userId, plan, expiresAt })
      .onConflictDoUpdate({
        target: subscriptions.userId,
        set: { plan, expiresAt, updatedAt: new Date() },
      });
  }
}

function currentPeriodKey(now = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}
