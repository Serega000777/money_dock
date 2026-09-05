import { index, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { accounts } from "./accounts";
import { users } from "./users";

export const importJobStatusEnum = pgEnum("import_job_status", [
  "previewed",
  "committed",
  "failed",
]);

/** One parsed row of an uploaded statement, before it becomes a transaction. */
export interface ImportDraftRow {
  rowNumber: number;
  status: "new" | "duplicate" | "review" | "error";
  error?: string;
  occurredAt?: string;
  amountMinor?: number;
  type?: "expense" | "income";
  merchant?: string;
  categoryId?: string | null;
  /** Set when status is "duplicate"/"review" — the transaction this row looks like. */
  duplicateOfTransactionId?: string;
}

export interface ImportStats {
  rowsFound: number;
  new: number;
  duplicates: number;
  errors: number;
  reviewNeeded: number;
}

export const importJobs = pgTable(
  "import_jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    fileName: text("file_name").notNull(),
    /** sha256 of the uploaded bytes — lets us spot a re-upload of the exact same file. */
    fileHash: text("file_hash").notNull(),
    status: importJobStatusEnum("status").notNull().default("previewed"),
    statsJson: jsonb("stats_json").$type<ImportStats>(),
    // The canonical draft model lives here until the user commits — no transaction row
    // is created before dedup + explicit commit (per spec).
    draftJson: jsonb("draft_json").$type<ImportDraftRow[]>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    committedAt: timestamp("committed_at", { withTimezone: true }),
  },
  (table) => [index("import_jobs_user_idx").on(table.userId)],
);
