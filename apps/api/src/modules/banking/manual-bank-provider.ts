import { Injectable, NotImplementedException } from "@nestjs/common";

import type {
  BankProvider,
  ConnectionToken,
  ExternalBankAccount,
  ExternalTransactionPage,
} from "./bank-provider";

/**
 * The "no bank" provider — cash/manual accounts have nothing to authorize or sync, so
 * every method is a documented no-op rather than an unimplemented gap in the contract.
 */
@Injectable()
export class ManualBankProvider implements BankProvider {
  // `async` so the throw rejects the returned promise instead of throwing synchronously
  // at the call site — every BankProvider method is meant to be awaited, real or not.
  async getAuthorizationUrl(): Promise<string> {
    throw new NotImplementedException("Manual accounts have no authorization flow");
  }

  async exchangeAuthorizationCode(): Promise<ConnectionToken> {
    throw new NotImplementedException("Manual accounts have no authorization flow");
  }

  getAccounts(): Promise<ExternalBankAccount[]> {
    return Promise.resolve([]);
  }

  getTransactions(): Promise<ExternalTransactionPage> {
    return Promise.resolve({ transactions: [], nextCursor: null });
  }

  revokeAccess(): Promise<void> {
    return Promise.resolve();
  }
}
