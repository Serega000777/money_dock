import { pgTable, unique, uuid } from "drizzle-orm/pg-core";

import { transactions } from "./transactions";

export const transfers = pgTable(
  "transfers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    outgoingTransactionId: uuid("outgoing_transaction_id")
      .notNull()
      .references(() => transactions.id, { onDelete: "cascade" }),
    incomingTransactionId: uuid("incoming_transaction_id")
      .notNull()
      .references(() => transactions.id, { onDelete: "cascade" }),
  },
  (table) => [
    unique("transfers_outgoing_unique").on(table.outgoingTransactionId),
    unique("transfers_incoming_unique").on(table.incomingTransactionId),
  ],
);
