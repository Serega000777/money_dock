import { normalizeMerchant } from "@money-dock/business-rules";
import { eq } from "drizzle-orm";

import { createDatabase } from "./client";
import { categories, merchantAliases } from "./schema";

const SYSTEM_EXPENSE_CATEGORIES: Array<{ systemCode: string; name: string; icon: string }> = [
  { systemCode: "groceries", name: "Продукты", icon: "shopping-cart" },
  { systemCode: "restaurants", name: "Кафе и рестораны", icon: "coffee" },
  { systemCode: "transport", name: "Транспорт", icon: "bus" },
  { systemCode: "fuel", name: "Топливо", icon: "fuel" },
  { systemCode: "housing", name: "ЖКХ и жильё", icon: "home" },
  { systemCode: "health", name: "Здоровье", icon: "heart" },
  { systemCode: "entertainment", name: "Развлечения", icon: "film" },
  { systemCode: "shopping", name: "Покупки", icon: "bag" },
  { systemCode: "communication", name: "Связь и интернет", icon: "wifi" },
  { systemCode: "other_expense", name: "Другое", icon: "more-horizontal" },
];

const SYSTEM_INCOME_CATEGORIES: Array<{ systemCode: string; name: string; icon: string }> = [
  { systemCode: "salary", name: "Зарплата", icon: "briefcase" },
  { systemCode: "freelance", name: "Подработка", icon: "laptop" },
  { systemCode: "other_income", name: "Другое", icon: "more-horizontal" },
];

/**
 * Global merchant → category defaults (spec §8/§18: `merchant_aliases`). `pattern` is a
 * normalized substring matched against statement merchant text, not a full merchant name
 * — statements append store numbers/cities to the brand ("OZON.RU MOSCOW #4").
 */
const MERCHANT_ALIASES: Array<{ pattern: string; systemCode: string }> = [
  { pattern: "ozon", systemCode: "shopping" },
  { pattern: "wildberries", systemCode: "shopping" },
  { pattern: "пятерочка", systemCode: "groceries" },
  { pattern: "пятёрочка", systemCode: "groceries" },
  { pattern: "магнит", systemCode: "groceries" },
  { pattern: "ашан", systemCode: "groceries" },
  { pattern: "перекресток", systemCode: "groceries" },
  { pattern: "перекрёсток", systemCode: "groceries" },
  { pattern: "вкусвилл", systemCode: "groceries" },
  { pattern: "яндекс такси", systemCode: "transport" },
  { pattern: "yandex taxi", systemCode: "transport" },
  { pattern: "uber", systemCode: "transport" },
  { pattern: "азс", systemCode: "fuel" },
  { pattern: "лукойл", systemCode: "fuel" },
  { pattern: "роснефть", systemCode: "fuel" },
  { pattern: "газпромнефть", systemCode: "fuel" },
  { pattern: "аптека", systemCode: "health" },
  { pattern: "мтс", systemCode: "communication" },
  { pattern: "билайн", systemCode: "communication" },
  { pattern: "мегафон", systemCode: "communication" },
  { pattern: "tele2", systemCode: "communication" },
  { pattern: "kfc", systemCode: "restaurants" },
  { pattern: "mcdonald", systemCode: "restaurants" },
  { pattern: "макдоналдс", systemCode: "restaurants" },
  { pattern: "бургер кинг", systemCode: "restaurants" },
  { pattern: "starbucks", systemCode: "restaurants" },
];

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  const db = createDatabase(databaseUrl);

  const rows = [
    ...SYSTEM_EXPENSE_CATEGORIES.map((c) => ({ ...c, type: "expense" as const })),
    ...SYSTEM_INCOME_CATEGORIES.map((c) => ({ ...c, type: "income" as const })),
  ];

  for (const row of rows) {
    await db
      .insert(categories)
      .values({
        userId: null,
        type: row.type,
        name: row.name,
        icon: row.icon,
        systemCode: row.systemCode,
      })
      .onConflictDoNothing({ target: categories.systemCode });
  }
  console.log(`Seeded ${rows.length} system categories.`);

  let aliasCount = 0;
  for (const alias of MERCHANT_ALIASES) {
    const [category] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.systemCode, alias.systemCode));
    if (!category) continue;

    const pattern = normalizeMerchant(alias.pattern);
    await db
      .insert(merchantAliases)
      .values({ normalizedName: pattern, rawPattern: pattern, defaultCategoryId: category.id })
      .onConflictDoUpdate({
        target: merchantAliases.rawPattern,
        set: { defaultCategoryId: category.id },
      });
    aliasCount += 1;
  }
  console.log(`Seeded ${aliasCount} merchant aliases.`);

  process.exit(0);
}

void main();
