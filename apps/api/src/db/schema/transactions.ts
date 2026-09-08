import { bigint, index, pgEnum, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

import { accounts } from "./accounts";
import { categories } from "./categories";
import { users } from "./users";

export const transactionTypeEnum = pgEnum("transaction_type", ["expense", "income", "transfer"]);
export const transactionSourceEnum = pgEnum("transaction_source", [
  "manual",
  "voice",
  "import",
  "bank_sync",
]);
export const transactionStatusEnum = pgEnum("transaction_status", ["confirmed", "needs_review"]);
// Only set for type='transfer': which leg of the transfer this row is. Kept as its own
// column (rather than derived by joining `transfers`) so balance queries need no join.
export const transferDirectionEnum = pgEnum("transfer_direction", ["out", "in"]);

export const transactions = pgTable(
  "transactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id").references(() => categories.id, { onDelete: "set null" }),
    type: transactionTypeEnum("type").notNull(),
    // Always positive; `type` (and `transferDirection` for transfers) decides the sign
    // when computing balances (ADR 0005 — integer minor units, never float).
    amountMinor: bigint("amount_minor", { mode: "number" }).notNull(),
    currency: text("currency").notNull(),
    transferDirection: transferDirectionEnum("transfer_direction"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    merchant: text("merchant"),
    note: text("note"),
    source: transactionSourceEnum("source").notNull().default("manual"),
    status: transactionStatusEnum("status").notNull().default("confirmed"),
    // Client-generated idempotency key (a UUID for a plain transaction; a transfer's two
    // legs derive `${clientId}:out` / `:in` from one client-supplied UUID, hence `text`
    // rather than `uuid` here — the API still requires the client-facing value to be a
    // real UUID via Zod).
    clientId: text("client_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    // Soft delete (spec §13): a deleted transaction is hidden from every read path below
    // but stays on disk so the user has a limited-time undo and support/audit can see it.
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    unique("transactions_user_client_unique").on(table.userId, table.clientId),
    index("transactions_user_occurred_idx").on(table.userId, table.occurredAt),
    index("transactions_account_idx").on(table.accountId),
  ],
);
