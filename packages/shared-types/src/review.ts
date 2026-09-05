export type ReviewReason =
  | "low_category_confidence"
  | "probable_duplicate"
  | "possible_transfer"
  | "import_error"
  | "missing_account";

export interface ReviewInboxItem {
  id: string;
  reason: ReviewReason;
  confidence: number | null;
  createdAt: string;
  transaction: {
    id: string;
    amountMinor: number;
    currency: string;
    merchant: string | null;
    occurredAt: string;
    categoryId: string | null;
  };
  suggestion: {
    duplicateOfTransactionId?: string;
    categoryId?: string;
    merchant?: string;
  } | null;
}
