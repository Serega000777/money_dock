import { index, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const userStatusEnum = pgEnum("user_status", ["active", "suspended", "deleted"]);
// Deliberately two, not a permissions matrix — the app has one owner-operator today, and
// "admin" means "sees the admin panel, can gift subscriptions", nothing more granular yet.
export const userRoleEnum = pgEnum("user_role", ["user", "admin"]);

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    displayName: text("display_name").notNull(),
    baseCurrency: text("base_currency").notNull().default("RUB"),
    timezone: text("timezone").notNull().default("Europe/Moscow"),
    locale: text("locale").notNull().default("ru"),
    // A small data: URI, not a file path — there's no object storage (S3) yet, and adding
    // one for a single small image isn't worth it before there's a real second use for it
    // (ADR 0007). The API caps the size on write; see updateMeSchema.
    avatarUrl: text("avatar_url"),
    // Set from ADMIN_TELEGRAM_IDS on login (see AuthService), not editable via any API —
    // there's no admin-inviting-another-admin flow, on purpose, until there's more than
    // one operator.
    role: userRoleEnum("role").notNull().default("user"),
    // Updated (throttled) on every authenticated request by JwtAuthGuard. Powers the
    // admin panel's "active" counts — nothing else reads it.
    lastActiveAt: timestamp("last_active_at", { withTimezone: true }),
    status: userStatusEnum("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("users_last_active_idx").on(table.lastActiveAt)],
);
