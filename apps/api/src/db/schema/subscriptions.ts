import {
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { users } from "./users";

/** Deliberately three tiers, not four — the spec calls out competitors' confusing ladders. */
export const planEnum = pgEnum("plan", ["free", "pro", "pro_bank"]);

/** Telegram may deliver the same payment more than once. */
export const starsPayments = pgTable("stars_payments", {
  chargeId: text("charge_id").primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  amount: integer("amount").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" })
      .unique(),
    plan: planEnum("plan").notNull().default("free"),
    /** null = perpetual (free); set for paid plans so an expiry downgrades cleanly. */
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("subscriptions_user_idx").on(table.userId)],
);

/**
 * Monthly usage per metered feature. `periodKey` is "YYYY-MM" in the user's timezone, so
 * a counter row is naturally scoped to a billing month without a cleanup job.
 */
export const usageCounters = pgTable(
  "usage_counters",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    feature: text("feature").notNull(),
    periodKey: text("period_key").notNull(),
    used: integer("used").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("usage_counters_unique").on(table.userId, table.feature, table.periodKey),
    index("usage_counters_user_idx").on(table.userId),
  ],
);
