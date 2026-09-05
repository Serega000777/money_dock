import { boolean, index, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

import { categories } from "./categories";
import { users } from "./users";

/**
 * A personal categorization rule, learned from the user's own corrections
 * ("всегда относить X к категории Y") — this is what makes manual work shrink
 * month over month instead of repeating forever.
 */
export const categoryRules = pgTable(
  "category_rules",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Normalized merchant string (lowercased, whitespace-collapsed). */
    pattern: text("pattern").notNull(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("category_rules_user_pattern_unique").on(table.userId, table.pattern),
    index("category_rules_user_idx").on(table.userId),
  ],
);
