import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { users } from "./users";

/** Only one type today (category_growth) — more slot in without touching the table shape. */
export const insightTypeEnum = pgEnum("insight_type", ["category_growth"]);
export const insightSeverityEnum = pgEnum("insight_severity", ["info", "warning", "critical"]);

/**
 * Persisted "Financial Director" insights (spec §20). The Insight Engine only ever reads
 * pre-computed aggregates and writes structured facts here — no LLM in this table, no
 * summing/forecasting happens at render time (ADR 0005-adjacent principle: money math is
 * deterministic, never trusted to a model).
 */
export const insights = pgTable(
  "insights",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: insightTypeEnum("type").notNull(),
    /** What the insight is about — a categoryId for category_growth. Lets a refresh
     * update the existing row (via the unique index below) instead of piling up dupes. */
    entityId: uuid("entity_id"),
    severity: insightSeverityEnum("severity").notNull(),
    /** Facts only (e.g. { categoryId, categoryName, currentMinor, previousMinor,
     * growthPercent }) — the client renders the sentence from `messageTemplateKey` + these. */
    payloadJson: jsonb("payload_json").notNull(),
    messageTemplateKey: text("message_template_key").notNull(),
    priority: integer("priority").notNull().default(50),
    validUntil: timestamp("valid_until", { withTimezone: true }).notNull(),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("insights_user_idx").on(table.userId),
    unique("insights_user_type_entity_unique").on(table.userId, table.type, table.entityId),
  ],
);
