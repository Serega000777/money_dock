import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { index, pgEnum, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

import { users } from "./users";

export const categoryTypeEnum = pgEnum("category_type", ["expense", "income"]);

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    // null = system default category, shared by everyone and read-only.
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    type: categoryTypeEnum("type").notNull(),
    name: text("name").notNull(),
    parentId: uuid("parent_id").references((): AnyPgColumn => categories.id, {
      onDelete: "set null",
    }),
    icon: text("icon"),
    // Hex string from the client's fixed palette; null falls back to a hash-of-id colour
    // (covers the seeded system categories, which predate this column).
    color: text("color"),
    systemCode: text("system_code"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("categories_user_id_idx").on(table.userId),
    // NULLs don't conflict with each other, so this only constrains system rows —
    // custom categories (systemCode always null) are unaffected.
    unique("categories_system_code_unique").on(table.systemCode),
  ],
);
