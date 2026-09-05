import { Inject, Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";

import type { Database } from "../../db/client";
import { DATABASE } from "../../db/database.token";
import { accounts, categories, transactions } from "../../db/schema";

interface DemoEntry {
  daysAgo: number;
  type: "expense" | "income";
  amountMinor: number;
  merchant: string;
  systemCode: string;
}

/** A believable month: salary in, groceries/transport/coffee out, one big-ticket item. */
const DEMO_ENTRIES: DemoEntry[] = [
  {
    daysAgo: 29,
    type: "income",
    amountMinor: 18_500_000,
    merchant: "Зарплата",
    systemCode: "salary",
  },
  {
    daysAgo: 28,
    type: "expense",
    amountMinor: 4_200_00,
    merchant: "Пятёрочка",
    systemCode: "groceries",
  },
  {
    daysAgo: 26,
    type: "expense",
    amountMinor: 1_450_00,
    merchant: "Яндекс Такси",
    systemCode: "transport",
  },
  {
    daysAgo: 24,
    type: "expense",
    amountMinor: 890_00,
    merchant: "Кофемания",
    systemCode: "restaurants",
  },
  {
    daysAgo: 22,
    type: "expense",
    amountMinor: 12_400_00,
    merchant: "ЖКХ Москва",
    systemCode: "housing",
  },
  { daysAgo: 20, type: "expense", amountMinor: 3_450_00, merchant: "АЗС ATAN", systemCode: "fuel" },
  {
    daysAgo: 18,
    type: "expense",
    amountMinor: 5_600_00,
    merchant: "Пятёрочка",
    systemCode: "groceries",
  },
  { daysAgo: 16, type: "expense", amountMinor: 6_980_00, merchant: "OZON", systemCode: "shopping" },
  {
    daysAgo: 14,
    type: "expense",
    amountMinor: 1_200_00,
    merchant: "Кофемания",
    systemCode: "restaurants",
  },
  {
    daysAgo: 12,
    type: "expense",
    amountMinor: 2_300_00,
    merchant: "Аптека Ригла",
    systemCode: "health",
  },
  {
    daysAgo: 10,
    type: "expense",
    amountMinor: 4_100_00,
    merchant: "Пятёрочка",
    systemCode: "groceries",
  },
  {
    daysAgo: 9,
    type: "expense",
    amountMinor: 990_00,
    merchant: "Яндекс Плюс",
    systemCode: "entertainment",
  },
  { daysAgo: 7, type: "expense", amountMinor: 3_450_00, merchant: "АЗС ATAN", systemCode: "fuel" },
  {
    daysAgo: 5,
    type: "expense",
    amountMinor: 2_800_00,
    merchant: "Вкусно и точка",
    systemCode: "restaurants",
  },
  {
    daysAgo: 4,
    type: "income",
    amountMinor: 2_500_000,
    merchant: "Фриланс-проект",
    systemCode: "freelance",
  },
  {
    daysAgo: 3,
    type: "expense",
    amountMinor: 7_300_00,
    merchant: "Пятёрочка",
    systemCode: "groceries",
  },
  {
    daysAgo: 2,
    type: "expense",
    amountMinor: 1_600_00,
    merchant: "Яндекс Такси",
    systemCode: "transport",
  },
  {
    daysAgo: 1,
    type: "expense",
    amountMinor: 890_00,
    merchant: "Кофемания",
    systemCode: "restaurants",
  },
  {
    daysAgo: 0,
    type: "expense",
    amountMinor: 3_280_00,
    merchant: "Магнит",
    systemCode: "groceries",
  },
];

/**
 * Fills a brand-new account with plausible history so the first screen answers its three
 * questions immediately, instead of showing an empty state (product spec: "демо-данные до
 * подключения реальных финансов", "первый полезный результат за 60 секунд").
 */
@Injectable()
export class DemoDataService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  /** No-op if the user already has accounts — never overwrites real data. */
  async seedFor(userId: string): Promise<void> {
    const existing = await this.db
      .select({ id: accounts.id })
      .from(accounts)
      .where(eq(accounts.userId, userId))
      .limit(1);
    if (existing.length > 0) return;

    const [cash, card] = await this.db
      .insert(accounts)
      .values([
        {
          userId,
          type: "cash" as const,
          name: "Наличные",
          currency: "RUB",
          initialBalanceMinor: 12_000_00,
        },
        {
          userId,
          type: "card" as const,
          name: "Основная карта",
          currency: "RUB",
          initialBalanceMinor: 84_500_00,
        },
      ])
      .returning();
    if (!cash || !card) return;

    const systemCategories = await this.db
      .select({ id: categories.id, systemCode: categories.systemCode })
      .from(categories);
    const categoryByCode = new Map(
      systemCategories.filter((c) => c.systemCode).map((c) => [c.systemCode!, c.id]),
    );

    const now = Date.now();
    await this.db.insert(transactions).values(
      DEMO_ENTRIES.map((entry, index) => ({
        userId,
        // Groceries and coffee come off cash, everything bigger off the card.
        accountId: entry.amountMinor <= 2_000_00 ? cash.id : card.id,
        categoryId: categoryByCode.get(entry.systemCode) ?? null,
        type: entry.type,
        amountMinor: entry.amountMinor,
        currency: "RUB",
        occurredAt: new Date(now - entry.daysAgo * 86_400_000),
        merchant: entry.merchant,
        source: "manual" as const,
        clientId: `demo:${userId}:${index}`,
      })),
    );
  }
}
