import { createHash } from "node:crypto";

import {
  classifyDedup,
  detectColumns,
  parseAmountToMinor,
  parseRowDate,
  RowParseError,
  type DedupMatch,
} from "@money-dock/business-rules";
import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { parse } from "csv-parse/sync";
import { and, desc, eq, gte } from "drizzle-orm";

import type { Database } from "../../db/client";
import { DATABASE } from "../../db/database.token";
import { firstOrThrow } from "../../db/first-or-throw";
import {
  importJobs,
  reviewItems,
  transactions,
  type ImportDraftRow,
  type ImportStats,
} from "../../db/schema";
import { AccountsService } from "../accounts/accounts.service";
import {
  CategorizationService,
  REVIEW_CONFIDENCE_THRESHOLD,
} from "../categorization/categorization.service";
import { EntitlementsService } from "../entitlements/entitlements.service";
import { TransactionsService } from "../transactions/transactions.service";

/** How far back to look for possible duplicates of an imported row. */
const DEDUP_WINDOW_DAYS = 5;

export interface ImportPreviewResult {
  jobId: string;
  stats: ImportStats;
  rows: ImportDraftRow[];
  /** Set when this exact file was already imported before. */
  alreadyImportedJobId?: string;
}

@Injectable()
export class ImportService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly accounts: AccountsService,
    private readonly categorization: CategorizationService,
    private readonly transactionsService: TransactionsService,
    private readonly entitlements: EntitlementsService,
  ) {}

  /**
   * Parses and dedups a statement without writing a single transaction — the user sees
   * exactly what would be created and commits explicitly (spec: canonical draft model).
   */
  async preview(
    userId: string,
    accountId: string,
    file: { originalname: string; buffer: Buffer },
  ): Promise<ImportPreviewResult> {
    await this.accounts.getOwned(userId, accountId); // ownership check — throws 404 if not the user's
    const fileHash = createHash("sha256").update(file.buffer).digest("hex");

    const [alreadyCommitted] = await this.db
      .select({ id: importJobs.id })
      .from(importJobs)
      .where(
        and(
          eq(importJobs.userId, userId),
          eq(importJobs.fileHash, fileHash),
          eq(importJobs.status, "committed"),
        ),
      );

    const records = this.parseCsv(file.buffer);
    if (records.length < 2)
      throw new BadRequestException("Файл пустой или содержит только заголовок");

    const [header, ...dataRows] = records as [string[], ...string[][]];
    let columns;
    try {
      columns = detectColumns(header);
    } catch (error) {
      throw new BadRequestException(
        error instanceof RowParseError ? error.message : "Не удалось разобрать заголовок",
      );
    }

    const history = await this.recentTransactions(userId, accountId);
    const rows: ImportDraftRow[] = [];

    for (const [index, record] of dataRows.entries()) {
      const rowNumber = index + 2; // 1-based, and the header is row 1
      try {
        rows.push(await this.buildDraftRow(userId, rowNumber, record, columns, history));
      } catch (error) {
        // A malformed row is reported and skipped — it never fails the whole job.
        rows.push({
          rowNumber,
          status: "error",
          error: error instanceof RowParseError ? error.message : "Не удалось разобрать строку",
        });
      }
    }

    const stats = summarize(rows);
    const job = firstOrThrow(
      await this.db
        .insert(importJobs)
        .values({
          userId,
          accountId,
          fileName: file.originalname,
          fileHash,
          status: "previewed",
          statsJson: stats,
          draftJson: rows,
        })
        .returning({ id: importJobs.id }),
    );

    return {
      jobId: job.id,
      stats,
      rows,
      ...(alreadyCommitted ? { alreadyImportedJobId: alreadyCommitted.id } : {}),
    };
  }

  /**
   * Creates transactions for everything the preview marked as new or review-worthy.
   * Safe to call twice: each row carries a deterministic clientId, so a retry after a
   * partial failure resumes instead of duplicating.
   */
  async commit(userId: string, jobId: string): Promise<ImportStats> {
    const [job] = await this.db
      .select()
      .from(importJobs)
      .where(and(eq(importJobs.id, jobId), eq(importJobs.userId, userId)));
    if (!job) throw new NotFoundException("Импорт не найден");
    if (job.status === "committed") return job.statsJson ?? emptyStats();

    // Previewing is free; committing is the act that costs a plan slot.
    await this.entitlements.consume(userId, "import");

    const account = await this.accounts.getOwned(userId, job.accountId);
    const draft = job.draftJson ?? [];
    for (const row of draft) {
      if (row.status === "error" || row.status === "duplicate") continue;
      if (!row.occurredAt || !row.amountMinor || !row.type) continue;

      const created = await this.transactionsService.create(
        userId,
        {
          type: row.type,
          accountId: job.accountId,
          categoryId: row.categoryId ?? undefined,
          amountMinor: row.amountMinor,
          currency: account.currency,
          occurredAt: row.occurredAt,
          merchant: row.merchant,
          clientId: `import:${job.id}:${row.rowNumber}`,
          splits: undefined,
        },
        {
          source: "import",
          status: row.status === "review" || row.categoryId == null ? "needs_review" : "confirmed",
        },
      );

      await this.flagForReview(userId, created.id, row);
    }

    await this.db
      .update(importJobs)
      .set({ status: "committed", committedAt: new Date() })
      .where(eq(importJobs.id, job.id));

    return job.statsJson ?? emptyStats();
  }

  async getJob(userId: string, jobId: string) {
    const [job] = await this.db
      .select()
      .from(importJobs)
      .where(and(eq(importJobs.id, jobId), eq(importJobs.userId, userId)));
    if (!job) throw new NotFoundException("Импорт не найден");
    return job;
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

  private async buildDraftRow(
    userId: string,
    rowNumber: number,
    record: string[],
    columns: { date: number; amount: number; merchant: number | null },
    history: DedupMatch[],
  ): Promise<ImportDraftRow> {
    const occurredAt = parseRowDate(record[columns.date] ?? "");
    const signedMinor = parseAmountToMinor(record[columns.amount] ?? "");
    if (signedMinor === 0) throw new RowParseError("Нулевая сумма");

    const merchant = (columns.merchant === null ? "" : (record[columns.merchant] ?? "")).trim();
    const amountMinor = Math.abs(signedMinor);
    const type = signedMinor < 0 ? ("expense" as const) : ("income" as const);

    const verdict = classifyDedup({ amountMinor, merchant }, history);
    const categorization = await this.categorization.categorize(userId, merchant);
    const needsCategoryReview = categorization.confidence < REVIEW_CONFIDENCE_THRESHOLD;

    const status: ImportDraftRow["status"] =
      verdict.tier === "duplicate"
        ? "duplicate"
        : verdict.tier === "review" || needsCategoryReview
          ? "review"
          : "new";

    return {
      rowNumber,
      status,
      occurredAt: occurredAt.toISOString(),
      amountMinor,
      type,
      merchant: merchant || undefined,
      categoryId: categorization.categoryId,
      ...(verdict.matchId ? { duplicateOfTransactionId: verdict.matchId } : {}),
    };
  }

  /** Explains to the user *why* a row needs a look, instead of silently guessing. */
  private async flagForReview(
    userId: string,
    transactionId: string,
    row: ImportDraftRow,
  ): Promise<void> {
    if (row.duplicateOfTransactionId && row.status === "review") {
      await this.db.insert(reviewItems).values({
        userId,
        transactionId,
        reason: "probable_duplicate",
        confidence: 70,
        suggestedJson: { duplicateOfTransactionId: row.duplicateOfTransactionId },
      });
      return;
    }

    if (row.categoryId == null) {
      await this.db.insert(reviewItems).values({
        userId,
        transactionId,
        reason: "low_category_confidence",
        confidence: 0,
        suggestedJson: { merchant: row.merchant },
      });
    }
  }

  private async recentTransactions(userId: string, accountId: string): Promise<DedupMatch[]> {
    const since = new Date(Date.now() - DEDUP_WINDOW_DAYS * 30 * 86_400_000);
    return this.db
      .select({
        id: transactions.id,
        amountMinor: transactions.amountMinor,
        merchant: transactions.merchant,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          eq(transactions.accountId, accountId),
          gte(transactions.occurredAt, since),
        ),
      )
      .orderBy(desc(transactions.occurredAt))
      .limit(2000);
  }
}

/**
 * Picks the delimiter from the header line instead of letting csv-parse accept several
 * at once: RU statements are semicolon-separated *and* use a decimal comma, so treating
 * "," as a delimiter too would split "1250,50" into two columns and shift every field.
 */
function sniffDelimiter(buffer: Buffer): string {
  const header = buffer.toString("utf8").split(/\r?\n/, 1)[0] ?? "";
  const counts = [";", "\t", ","].map((d) => ({ d, n: header.split(d).length - 1 }));
  const best = counts.reduce((a, b) => (b.n > a.n ? b : a));
  return best.n > 0 ? best.d : ",";
}

function emptyStats(): ImportStats {
  return { rowsFound: 0, new: 0, duplicates: 0, errors: 0, reviewNeeded: 0 };
}

function summarize(rows: readonly ImportDraftRow[]): ImportStats {
  return {
    rowsFound: rows.length,
    new: rows.filter((r) => r.status === "new").length,
    duplicates: rows.filter((r) => r.status === "duplicate").length,
    errors: rows.filter((r) => r.status === "error").length,
    reviewNeeded: rows.filter((r) => r.status === "review").length,
  };
}
