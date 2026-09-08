import { index, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

import { categories } from "./categories";

/**
 * Global (not per-user) merchant → category defaults, curated centrally (spec §8/§18:
 * "merchant_aliases"). `rawPattern` is a normalized substring to match against a
 * statement's merchant text (e.g. "ozon", "пятерочка") — not a full merchant name, since
 * statements append store numbers/cities to the brand name.
 */
export const merchantAliases = pgTable(
  "merchant_aliases",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    normalizedName: text("normalized_name").notNull(),
    rawPattern: text("raw_pattern").notNull(),
    defaultCategoryId: uuid("default_category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("merchant_aliases_raw_pattern_unique").on(table.rawPattern),
    index("merchant_aliases_normalized_idx").on(table.normalizedName),
  ],
);
