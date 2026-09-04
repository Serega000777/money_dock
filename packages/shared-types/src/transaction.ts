import type { CurrencyCode, MinorUnits } from "./money";

export type TransactionType = "expense" | "income" | "transfer";

export type TransactionSource = "manual" | "voice" | "import" | "bank_sync";

export type TransactionStatus = "confirmed" | "needs_review";

export interface TransactionSplit {
  categoryId: string;
  amountMinor: MinorUnits;
}

export interface Transaction {
  id: string;
  accountId: string;
  categoryId: string | null;
  type: TransactionType;
  amountMinor: MinorUnits;
  currency: CurrencyCode;
  occurredAt: string;
  merchant: string | null;
  note: string | null;
  source: TransactionSource;
  status: TransactionStatus;
  splits: TransactionSplit[];
}
