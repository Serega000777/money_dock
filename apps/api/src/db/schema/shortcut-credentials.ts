import { index, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

import { users } from "./users";

export const shortcutCredentials = pgTable(
  "shortcut_credentials",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    name: text("name").notNull().default("iPhone"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
  },
  (table) => [
    unique("shortcut_credentials_token_hash_unique").on(table.tokenHash),
    index("shortcut_credentials_user_idx").on(table.userId),
  ],
);
