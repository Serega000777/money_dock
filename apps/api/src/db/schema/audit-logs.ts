import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { users } from "./users";

/** Append-only trail of user decisions that change money data (spec: Review Inbox
 * decisions must be auditable). Never updated, never deleted from app code. */
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("audit_logs_user_idx").on(table.userId)],
);
