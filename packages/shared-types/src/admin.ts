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
}

export interface AdminUserSummary {
  id: string;
  displayName: string;
  plan: Plan;
  planExpiresAt: string | null;
  lastActiveAt: string | null;
  createdAt: string;
}
