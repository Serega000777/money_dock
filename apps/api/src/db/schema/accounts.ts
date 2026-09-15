import { bigint, index, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { users } from "./users";

export const accountTypeEnum = pgEnum("account_type", ["cash", "card", "bank"]);
export const bankEnum = pgEnum("bank", ["sber", "alfa", "tinkoff", "vtb", "ozon"]);

export const accounts = pgTable(
  "accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: accountTypeEnum("type").notNull(),
    name: text("name").notNull(),
    currency: text("currency").notNull(),
    // Purely visual: which bank's card design the app draws for a `card` account, and
    // the last four digits printed on it. Neither is used for anything else — there is
    // no bank connection (see the deploy guide), so nothing here is a credential.
    bank: bankEnum("bank"),
    cardLast4: text("card_last4"),
    // Minor units, never float (ADR 0005). bigint gives headroom beyond safe-integer money math.
    initialBalanceMinor: bigint("initial_balance_minor", { mode: "number" }).notNull().default(0),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("accounts_user_id_idx").on(table.userId)],
);
