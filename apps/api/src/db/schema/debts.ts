import { bigint, index, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { users } from "./users";

// Whose money it is — see the shared-type comment on DebtDirection.
export const debtDirectionEnum = pgEnum("debt_direction", ["owed_to_me", "i_owe"]);

// A personal ledger the user keeps by hand — "Саша должен 3000" — not a real payment
// integration: nothing here moves money or notifies the counterparty. `settledAt` marks
// it paid/collected without deleting the row, so a resolved debt stays visible in its
// own state instead of just vanishing.
export const debts = pgTable(
  "debts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    direction: debtDirectionEnum("direction").notNull(),
    counterpartyName: text("counterparty_name").notNull(),
    amountMinor: bigint("amount_minor", { mode: "number" }).notNull(),
    currency: text("currency").notNull(),
    note: text("note"),
    dueDate: timestamp("due_date", { withTimezone: true }),
    settledAt: timestamp("settled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("debts_user_idx").on(table.userId)],
);
