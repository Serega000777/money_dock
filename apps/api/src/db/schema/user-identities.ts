import { pgEnum, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

import { users } from "./users";

export const identityProviderEnum = pgEnum("identity_provider", [
  "telegram",
  "phone_sms",
  "yandex",
  "vk",
  "apple",
  "telegram_link",
]);

export const userIdentities = pgTable(
  "user_identities",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: identityProviderEnum("provider").notNull(),
    providerUserId: text("provider_user_id").notNull(),
    phone: text("phone"),
    email: text("email"),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique("user_identities_provider_unique").on(table.provider, table.providerUserId)],
);
