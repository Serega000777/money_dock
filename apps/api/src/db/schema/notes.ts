import { boolean, index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { users } from "./users";

/**
 * Free-form notes — the "Заметки" hub in the cabinet. Deliberately not linked to
 * transactions: this is a scratchpad for financial plans and reminders, and keeping it
 * standalone means it never complicates the ledger.
 */
export const notes = pgTable(
  "notes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    body: text("body").notNull().default(""),
    /** Index into the shared category palette, so notes get colour without storing hex. */
    colorIndex: integer("color_index").notNull().default(0),
    pinned: boolean("pinned").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("notes_user_id_idx").on(table.userId)],
);
