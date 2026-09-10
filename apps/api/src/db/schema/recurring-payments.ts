import { bigint, index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { accounts } from "./accounts";
import { categories } from "./categories";
import { users } from "./users";

// "Regular payments" the user sets up themselves (Окко 299₽/мес and the like) — a
// reminder list, not an auto-charging scheduler. Always monthly: `dueDay` is a day of
// the month (null = no fixed day, just "sometime this month"). Paying one creates a
// normal transaction and stamps `lastPaidAt`; nothing runs on a schedule server-side.
export const recurringPayments = pgTable(
  "recurring_payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id").references(() => categories.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    amountMinor: bigint("amount_minor", { mode: "number" }).notNull(),
    currency: text("currency").notNull(),
    // 1-31; null = no fixed date, due "sometime this month".
    dueDay: integer("due_day"),
    // Days before dueDay to flag as "coming up" in the list; null = no reminder,
    // meaningless when dueDay is null. There's no push/bot notification wiring yet
    // (spec's "Telegram-уведомления" is a separate, later piece) — this only drives the
    // in-app badge for now.
    reminderDaysBefore: integer("reminder_days_before"),
    lastPaidAt: timestamp("last_paid_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("recurring_payments_user_idx").on(table.userId)],
);
