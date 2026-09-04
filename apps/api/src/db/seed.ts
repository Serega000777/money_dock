import { createDatabase } from "./client";
import { categories } from "./schema";

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
  process.exit(0);
}

void main();
