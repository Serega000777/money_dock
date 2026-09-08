import {
  addDays,
  averageDailySpend,
  daysInMonth,
  daysRemainingInMonth,
  dayOfMonth,
  monthEndForecast,
  percentChange,
  safeToSpendPerDay,
  startOfDay,
  startOfMonth,
  startOfPreviousMonth,
} from "@money-dock/business-rules";
import { asMinorUnits, type AnalyticsSummary } from "@money-dock/shared-types";
import { Inject, Injectable } from "@nestjs/common";
import { and, eq, gte, isNull, lt, sql } from "drizzle-orm";

import type { Database } from "../../db/client";
import { DATABASE } from "../../db/database.token";
import { accounts as accountsTable, transactions } from "../../db/schema";
import { AccountsService } from "../accounts/accounts.service";
import { UsersService } from "../users/users.service";

interface PeriodTotals {
  incomeMinor: number;
  expenseMinor: number;
}

interface ExpenseByPaymentKind {
  cashMinor: number;
  bankMinor: number;
}

@Injectable()
export class AnalyticsService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly accounts: AccountsService,
    private readonly users: UsersService,
  ) {}

  async getSummary(userId: string, now = new Date()): Promise<AnalyticsSummary> {
    const user = await this.users.getById(userId);
    const tz = user.timezone;

    const accounts = await this.accounts.list(userId);
    const totalBalanceMinor = accounts.reduce((sum, a) => sum + a.currentBalanceMinor, 0);

    const elapsedDays = dayOfMonth(now, tz);
    const daysRemaining = daysRemainingInMonth(now, tz);
    const monthStart = startOfMonth(now, tz);
    const prevMonthStart = startOfPreviousMonth(now, tz);
    const dayStart = startOfDay(now, tz);

    const [currentMonth, comparableLastMonth, today, byPaymentKind] = await Promise.all([
      this.periodTotals(userId, monthStart, undefined),
      // Compare against the same number of elapsed days last month — comparing a
      // partial current month to a *full* previous month would understate spend growth.
      this.periodTotals(userId, prevMonthStart, addDays(prevMonthStart, elapsedDays)),
      this.periodTotals(userId, dayStart, undefined),
      this.expenseByPaymentKind(userId, monthStart),
    ]);

    const avgDailySpendMinor = averageDailySpend(currentMonth.expenseMinor, elapsedDays);

    return {
      totalBalanceMinor: asMinorUnits(totalBalanceMinor),
      safeToSpendPerDayMinor: asMinorUnits(
        Math.round(safeToSpendPerDay(totalBalanceMinor, daysRemaining)),
      ),
      daysRemainingInMonth: daysRemaining,
      monthEndForecastMinor: asMinorUnits(
        Math.round(monthEndForecast(totalBalanceMinor, avgDailySpendMinor, daysRemaining)),
      ),
      currentMonthExpenseMinor: asMinorUnits(currentMonth.expenseMinor),
      currentMonthIncomeMinor: asMinorUnits(currentMonth.incomeMinor),
      expenseChangePercent: percentChange(
        comparableLastMonth.expenseMinor,
        currentMonth.expenseMinor,
      ),
      todayExpenseMinor: asMinorUnits(today.expenseMinor),
      daysInMonth: daysInMonth(now, tz),
      currentMonthExpenseCashMinor: asMinorUnits(byPaymentKind.cashMinor),
      currentMonthExpenseBankMinor: asMinorUnits(byPaymentKind.bankMinor),
    };
  }

  private async periodTotals(
    userId: string,
    from: Date,
    to: Date | undefined,
  ): Promise<PeriodTotals> {
    const conditions = [
      eq(transactions.userId, userId),
      isNull(transactions.deletedAt),
      gte(transactions.occurredAt, from),
    ];
    if (to) conditions.push(lt(transactions.occurredAt, to));

    const [row] = await this.db
      .select({
        income:
          sql<number>`coalesce(sum(case when ${transactions.type} = 'income' then ${transactions.amountMinor} else 0 end), 0)`.mapWith(
            Number,
          ),
        expense:
          sql<number>`coalesce(sum(case when ${transactions.type} = 'expense' then ${transactions.amountMinor} else 0 end), 0)`.mapWith(
            Number,
          ),
      })
      .from(transactions)
      .where(and(...conditions));

    return { incomeMinor: row?.income ?? 0, expenseMinor: row?.expense ?? 0 };
  }

  /** Same expense total as periodTotals, split by `accounts.type` — "cash" vs. "card"/
   * "bank" combined (home screen: "траты наличными" / "траты с банка"). */
  private async expenseByPaymentKind(userId: string, from: Date): Promise<ExpenseByPaymentKind> {
    const rows = await this.db
      .select({
        kind: accountsTable.type,
        total: sql<number>`coalesce(sum(${transactions.amountMinor}), 0)`.mapWith(Number),
      })
      .from(transactions)
      .innerJoin(accountsTable, eq(transactions.accountId, accountsTable.id))
      .where(
        and(
          eq(transactions.userId, userId),
          eq(transactions.type, "expense"),
          isNull(transactions.deletedAt),
          gte(transactions.occurredAt, from),
        ),
      )
      .groupBy(accountsTable.type);

    let cashMinor = 0;
    let bankMinor = 0;
    for (const row of rows) {
      if (row.kind === "cash") cashMinor += row.total;
      else bankMinor += row.total;
    }
    return { cashMinor, bankMinor };
  }
}
