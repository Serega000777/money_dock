export interface ImportDraftRow {
  rowNumber: number;
  status: "new" | "duplicate" | "review" | "error";
  error?: string;
  occurredAt?: string;
  amountMinor?: number;
  type?: "expense" | "income";
  merchant?: string;
  categoryId?: string | null;
  duplicateOfTransactionId?: string;
}

export interface ImportStats {
  rowsFound: number;
  new: number;
  duplicates: number;
  errors: number;
  reviewNeeded: number;
}

export interface ImportPreview {
  jobId: string;
  stats: ImportStats;
  rows: ImportDraftRow[];
  alreadyImportedJobId?: string;
}
