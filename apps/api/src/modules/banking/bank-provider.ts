/**
 * One contract for every source of external transactions — CSV/manual today, an Open
 * Banking API later (spec §23) — so TransactionsModule and the import/dedup/
 * categorization pipeline never have to change when a new provider is added. MVP ships
 * only `ManualBankProvider` and `CsvBankProvider` (below); no real bank integration is
 * implemented against this contract yet — see docs/architecture/overview.md.
 */
export interface BankProvider {
  getAuthorizationUrl(userId: string): Promise<string>;
  exchangeAuthorizationCode(code: string): Promise<ConnectionToken>;
  getAccounts(token: ConnectionToken): Promise<ExternalBankAccount[]>;
  getTransactions(input: SyncInput): Promise<ExternalTransactionPage>;
  revokeAccess(token: ConnectionToken): Promise<void>;
}

export interface ConnectionToken {
  provider: string;
  /** Provider-specific payload — opaque to everything except that provider's own adapter. */
  payload: unknown;
}

export interface ExternalBankAccount {
  externalId: string;
  name: string;
  currency: string;
}

export interface SyncInput {
  connectionToken: ConnectionToken;
  /** Only fetch transactions at or after this ISO timestamp, when the provider supports it. */
  since?: string;
  /** Opaque pagination cursor from a previous page. */
  cursor?: string;
}

export interface ExternalTransactionRow {
  /** Provider-assigned id, when one exists — the strong signal ahead of fuzzy dedup
   * scoring (spec §17: "Exact external transaction ID всегда сильнее fingerprint"). */
  externalId?: string;
  occurredAt: string;
  amountMinor: number;
  type: "expense" | "income";
  merchant?: string;
}

export interface ExternalTransactionPage {
  transactions: ExternalTransactionRow[];
  /** Null when this is the last page (or the provider has no pagination, like CSV). */
  nextCursor: string | null;
}
