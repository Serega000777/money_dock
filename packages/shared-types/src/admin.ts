import type { Plan } from "./command";

/** Counts for the admin dashboard. `activeToday`/`activeLast30Days` both read `lastActiveAt`
 * (touched on every authenticated request), just over different windows. */
export interface AdminStats {
  totalUsers: number;
  activeToday: number;
  activeLast30Days: number;
  /** Financial accounts (cash/card/bank) across every user — a distinct, separate count
   * from `totalUsers`: how many wallets people have actually set up, not how many people
   * signed up. */
  totalAccounts: number;
  /** How many users are on each tier right now — the raw stored plan (a missing
   * subscription row counts as `free`), same definition AdminUserSummary.plan uses. */
  planBreakdown: Record<Plan, number>;
  /** Telegram Stars actually collected (in Stars, not minor units — Stars has no
   * fractional unit) — the one real revenue number until another payment method ships. */
  starsRevenue: { total: number; last30Days: number };
  /** New signups per calendar day (UTC) for the last 14 days, oldest first. */
  signupsByDay: { date: string; count: number }[];
}

export interface AdminUserSummary {
  id: string;
  displayName: string;
  plan: Plan;
  planExpiresAt: string | null;
  lastActiveAt: string | null;
  createdAt: string;
}
