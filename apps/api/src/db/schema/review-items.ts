import { index, integer, jsonb, pgEnum, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";

import { transactions } from "./transactions";
import { users } from "./users";

export const reviewReasonEnum = pgEnum("review_reason", [
  "low_category_confidence",
  "probable_duplicate",
  "possible_transfer",
  "import_error",
  "missing_account",
  // Saved without confirmation (Siri shortcut, home-screen widget): the phrase was
  // never shown back to the user, so it waits here until they confirm or fix it.
  "unconfirmed_capture",
]);

export const reviewStatusEnum = pgEnum("review_status", ["pending", "resolved", "dismissed"]);

export interface ReviewSuggestion {
  duplicateOfTransactionId?: string;
  categoryId?: string;
  merchant?: string;
}

export const reviewItems = pgTable(
  "review_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    transactionId: uuid("transaction_id")
      .notNull()
      .references(() => transactions.id, { onDelete: "cascade" }),
    reason: reviewReasonEnum("reason").notNull(),
    /** 0-100. What the system thought before asking the user. */
    confidence: integer("confidence"),
    suggestedJson: jsonb("suggested_json").$type<ReviewSuggestion>(),
    status: reviewStatusEnum("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (table) => [index("review_items_user_status_idx").on(table.userId, table.status)],
);
