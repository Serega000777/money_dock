import { bigint, date, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { users } from "./users";

// "На что копить": a target the user is saving toward (Отпуск — 200 000 ₽) and how much
// they have put aside so far. It's a tracker, not a ledger — contributing to a goal bumps
// `savedMinor` and nothing else; it does not move money between accounts or create a
// transaction, because the money is already sitting in one of the user's accounts. The
// goal just earmarks it.
export const savingsGoals = pgTable(
  "savings_goals",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    // One of the app's own icon names (see apps/app Icon.tsx PICKABLE_ICONS); null = default.
    icon: text("icon"),
    targetMinor: bigint("target_minor", { mode: "number" }).notNull(),
    savedMinor: bigint("saved_minor", { mode: "number" }).notNull().default(0),
    currency: text("currency").notNull(),
    // Optional "by when" — a calendar date, no time component.
    deadline: date("deadline"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("savings_goals_user_idx").on(table.userId)],
);
