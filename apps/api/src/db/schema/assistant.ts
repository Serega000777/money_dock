import { index, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { users } from "./users";

export const assistantRoleEnum = pgEnum("assistant_message_role", ["user", "assistant"]);
export const assistantInputTypeEnum = pgEnum("assistant_input_type", ["text", "voice"]);
export const assistantMessageStatusEnum = pgEnum("assistant_message_status", ["completed", "failed"]);
export const assistantActionStatusEnum = pgEnum("assistant_action_status", [
  "pending",
  "executing",
  "completed",
  "cancelled",
  "failed",
  "expired",
]);
export const assistantRiskEnum = pgEnum("assistant_action_risk", ["low", "medium", "high"]);

export const assistantConversations = pgTable(
  "assistant_conversations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull().default("Новый разговор"),
    summary: text("summary"),
    contextJson: jsonb("context_json"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (table) => [index("assistant_conversations_user_updated_idx").on(table.userId, table.updatedAt)],
);

export const assistantMessages = pgTable(
  "assistant_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => assistantConversations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: assistantRoleEnum("role").notNull(),
    inputType: assistantInputTypeEnum("input_type").notNull().default("text"),
    content: text("content").notNull(),
    transcript: text("transcript"),
    metadataJson: jsonb("metadata_json"),
    status: assistantMessageStatusEnum("status").notNull().default("completed"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("assistant_messages_conversation_created_idx").on(table.conversationId, table.createdAt)],
);

export const assistantPendingActions = pgTable(
  "assistant_pending_actions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => assistantConversations.id, { onDelete: "cascade" }),
    tool: text("tool").notNull(),
    argumentsJson: jsonb("arguments_json").notNull(),
    previewJson: jsonb("preview_json").notNull(),
    resultJson: jsonb("result_json"),
    riskLevel: assistantRiskEnum("risk_level").notNull().default("medium"),
    status: assistantActionStatusEnum("status").notNull().default("pending"),
    idempotencyKey: uuid("idempotency_key").notNull().defaultRandom().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    executedAt: timestamp("executed_at", { withTimezone: true }),
  },
  (table) => [index("assistant_pending_actions_user_status_idx").on(table.userId, table.status)],
);

