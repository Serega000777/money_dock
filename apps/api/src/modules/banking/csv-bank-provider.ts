import { detectColumns, parseAmountToMinor, parseRowDate, RowParseError } from "@money-dock/business-rules";
import { BadRequestException, Injectable, NotImplementedException } from "@nestjs/common";
import { parse } from "csv-parse/sync";

import type {
  BankProvider,
  ConnectionToken,
  ExternalBankAccount,
  ExternalTransactionPage,
  ExternalTransactionRow,
  SyncInput,
} from "./bank-provider";

export interface CsvConnectionPayload {
  buffer: Buffer;
}

/**
 * Turns one uploaded statement into normalized external transactions (spec §23: "MVP
 * может содержать только CsvBankProvider/ManualProvider"). A file upload has no OAuth
 * step, so the authorization methods are deliberately unsupported rather than faked.
 *
 * Not yet wired into ImportModule — `ImportService` still parses CSV inline (it also
 * does per-row fault tolerance and dedup/categorization in the same pass, which don't
 * fit this generic contract's clean-bulk-fetch shape). This class exists so the contract
 * itself has a real, tested implementation now, ahead of a future refactor or an actual
 * bank integration.
 */
@Injectable()
export class CsvBankProvider implements BankProvider {
  // `async` so the throw rejects the returned promise instead of throwing synchronously
  // at the call site — every BankProvider method is meant to be awaited, real or not.
  async getAuthorizationUrl(): Promise<string> {
    throw new NotImplementedException("CSV import has no authorization flow — the user uploads a file");
  }

  async exchangeAuthorizationCode(): Promise<ConnectionToken> {
    throw new NotImplementedException("CSV import has no authorization flow — the user uploads a file");
  }

  getAccounts(): Promise<ExternalBankAccount[]> {
    // The target account is chosen by the user before upload, not discovered from the file.
    return Promise.resolve([]);
  }

  revokeAccess(): Promise<void> {
    return Promise.resolve();
  }

  /** `async` (despite no `await`) so every `throw` below rejects the promise instead of
   * throwing synchronously — callers `await` this like every other `BankProvider` method. */
  async getTransactions(input: SyncInput): Promise<ExternalTransactionPage> {
    const { buffer } = input.connectionToken.payload as CsvConnectionPayload;
    const records = this.parseCsv(buffer);
    if (records.length < 2) {
      throw new BadRequestException("Файл пустой или содержит только заголовок");
    }

    const [header, ...dataRows] = records as [string[], ...string[][]];
    let columns;
    try {
      columns = detectColumns(header);
    } catch (error) {
      throw new BadRequestException(
        error instanceof RowParseError ? error.message : "Не удалось разобрать заголовок",
      );
    }

    const transactions: ExternalTransactionRow[] = dataRows.map((record) => {
      const occurredAt = parseRowDate(record[columns.date] ?? "");
      const signedMinor = parseAmountToMinor(record[columns.amount] ?? "");
      if (signedMinor === 0) throw new RowParseError("Нулевая сумма");
      const merchant = (columns.merchant === null ? "" : (record[columns.merchant] ?? "")).trim();

      return {
        occurredAt: occurredAt.toISOString(),
        amountMinor: Math.abs(signedMinor),
        type: signedMinor < 0 ? "expense" : "income",
        merchant: merchant || undefined,
      };
    });

    return { transactions, nextCursor: null };
  }

  private parseCsv(buffer: Buffer): string[][] {
    try {
      return parse(buffer, {
        bom: true,
        skip_empty_lines: true,
        relax_column_count: true,
        trim: true,
        delimiter: sniffDelimiter(buffer),
      }) as string[][];
    } catch {
      throw new BadRequestException("Не удалось прочитать CSV-файл");
    }
  }
}

/** Duplicated from ImportService intentionally (see class doc above) — the two will
 * merge onto one CSV-parsing primitive once this provider is actually wired in. */
function sniffDelimiter(buffer: Buffer): string {
  const header = buffer.toString("utf8").split(/\r?\n/, 1)[0] ?? "";
  const counts = [";", "\t", ","].map((d) => ({ d, n: header.split(d).length - 1 }));
  const best = counts.reduce((a, b) => (b.n > a.n ? b : a));
  return best.n > 0 ? best.d : ",";
}
