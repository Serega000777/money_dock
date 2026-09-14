import { pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const userStatusEnum = pgEnum("user_status", ["active", "suspended", "deleted"]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  displayName: text("display_name").notNull(),
  baseCurrency: text("base_currency").notNull().default("RUB"),
  timezone: text("timezone").notNull().default("Europe/Moscow"),
  locale: text("locale").notNull().default("ru"),
  // A small data: URI, not a file path — there's no object storage (S3) yet, and adding
  // one for a single small image isn't worth it before there's a real second use for it
  // (ADR 0007). The API caps the size on write; see updateMeSchema.
  avatarUrl: text("avatar_url"),
  status: userStatusEnum("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
