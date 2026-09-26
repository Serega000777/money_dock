import { CommandParseError, normalizeMerchant, parseCommand } from "@money-dock/business-rules";
import type { CurrencyCode, Transaction } from "@money-dock/shared-types";
import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { and, eq, inArray, isNull, or } from "drizzle-orm";

import type { Database } from "../../db/client";
import { DATABASE } from "../../db/database.token";
import { accounts, categories, categoryRules, reviewItems, transactions, users } from "../../db/schema";
import { CategorizationService } from "../categorization/categorization.service";
import { EntitlementsService } from "../entitlements/entitlements.service";
import { TransactionsService } from "../transactions/transactions.service";

import { TranscriptionService } from "./transcription.service";

export interface CommandDraft {
  type: "expense" | "income";
  amountMinor: number;
  currency: string;
  accountId: string | null;
  accountName: string | null;
  categoryId: string | null;
  categoryName: string | null;
  occurredAt: string;
  confidence: number;
  /** Human-readable reasons, so the confirmation card can explain itself. */
  explanation: string[];
  description: string | null;
  requiresConfirmation: boolean;
}

const EXPLANATIONS: Record<string, string> = {
  amount: "сумма",
  type: "тип операции",
  category: "категория",
  account: "счёт",
  date: "дата",
};

/**
 * Turns a spoken/typed phrase into a *draft* only. Nothing is written here — the client
 * shows the parse for confirmation first, because the spec forbids auto-saving anything
 * that was recognized with doubt.
 */
@Injectable()
export class CommandsService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly entitlements: EntitlementsService,
    private readonly transactions: TransactionsService,
    private readonly categorization: CategorizationService,
    private readonly transcription: TranscriptionService,
  ) {}

  /**
   * Hands-free capture for Siri, the home-screen widget, and the iOS Shortcut: the
   * phrase is never shown back before saving — there is no confirmation step in the
   * request itself — so this always stores needs_review and queues a Review Inbox item,
   * regardless of how confident the parse was. `draft.requiresConfirmation` is for the
   * *other* capture path (`parse` + an on-screen confirm card, e.g. the /voice screen),
   * which can act on a low-confidence parse by asking before it ever calls this method.
   */
  async capture(
    userId: string,
    text: string,
    source: "voice" | "text",
    clientId: string,
    accountId?: string,
    transactionSource: "voice" | "shortcut" = "voice",
  ): Promise<Transaction> {
    const draft = await this.parse(userId, text, source);
    const targetAccountId = accountId ?? draft.accountId;
    if (!targetAccountId) throw new BadRequestException("Сначала добавьте счёт");

    const transaction = await this.transactions.create(
      userId,
      {
        type: draft.type,
        accountId: targetAccountId,
        categoryId: draft.categoryId ?? undefined,
        amountMinor: draft.amountMinor,
        currency: draft.currency as CurrencyCode,
        occurredAt: draft.occurredAt,
        note: text,
        clientId,
      },
      { source: transactionSource, status: "needs_review" },
    );

    await this.db.transaction(async (tx) => {
      await tx.select({ id: transactions.id }).from(transactions).where(eq(transactions.id, transaction.id)).for("update");
      const [existing] = await tx.select({ id: reviewItems.id }).from(reviewItems)
        .where(eq(reviewItems.transactionId, transaction.id));
      if (!existing && transaction.status === "needs_review") await tx.insert(reviewItems).values({
        userId,
        transactionId: transaction.id,
        reason: "unconfirmed_capture",
        confidence: Math.round(draft.confidence * 100),
        suggestedJson: draft.categoryId ? { categoryId: draft.categoryId } : null,
      });
    });

    return transaction;
  }

  /** Same as `parse(text, "voice")`, except the text comes from a recorded clip instead
   * of the browser's own speech recognizer — the path iOS needs, since WebKit has never
   * implemented `SpeechRecognition`. Voice quota is charged exactly once, inside the
   * `parse()` call below — transcribing itself isn't metered separately. */
  async parseAudio(userId: string, audio: Buffer, mimeType: string): Promise<CommandDraft> {
    const text = await this.transcription.transcribe(audio, mimeType);
    return this.parse(userId, text, "voice");
  }

  async parse(userId: string, text: string, source: "voice" | "text"): Promise<CommandDraft> {
    // Voice carries a real per-use cost, so it is metered; typing is free.
    if (source === "voice") await this.entitlements.consume(userId, "voice");

    let parsed;
    try {
      parsed = parseCommand(text);
    } catch (error) {
      throw new BadRequestException(
        error instanceof CommandParseError ? error.message : "Не удалось разобрать команду",
      );
    }

    const userAccounts = await this.accountsForUser(userId);

    const [user] = await this.db.select({ timezone: users.timezone }).from(users).where(eq(users.id, userId));

    // Same normalizer categories.service.ts writes category_rules.pattern with (and the
    // one statement-import matching already reads it with) — a hand-rolled duplicate
    // here previously folded ё→е on read but not on write, so an alias containing ё
    // could never match. A pattern under 2 characters is excluded: a single letter would
    // match almost any phrase, hijacking the category for input that isn't about it.
    const normalized = normalizeMerchant(text);
    const customMatches = await this.db.select({ id: categories.id, name: categories.name, type: categories.type, pattern: categoryRules.pattern })
      .from(categoryRules).innerJoin(categories, eq(categories.id, categoryRules.categoryId))
      .where(and(eq(categoryRules.userId, userId), eq(categoryRules.active, true), eq(categories.userId, userId)));
    const custom = customMatches
      .filter((row) => row.pattern.length >= 2)
      .sort((a, b) => b.pattern.length - a.pattern.length)
      .find((row) => normalized.includes(row.pattern));

    if (custom && custom.type !== "both" && !parsed.matched.includes("type")) parsed.type = custom.type;

    const allAccounts = await this.db
      .select()
      .from(accounts)
      .where(and(isNull(accounts.archivedAt), inArray(accounts.id, userAccounts.map((a) => a.id))));

    // Prefer the account type the user named; otherwise fall back to their first account.
    const account =
      (parsed.accountType && allAccounts.find((a) => a.type === parsed.accountType)) ||
      allAccounts[0] ||
      null;

    const matched = [...parsed.matched];
    let confidence = parsed.confidence;

    // The parser's own keyword hints first; then, for expenses, the same pipeline a bank
    // statement goes through (the user's own rules and history, brand aliases, the local
    // classifier) run over the whole phrase — "яндекс такси" or "вкусвилл" are brands
    // the parser deliberately doesn't know; and finally "Другое", so the draft always
    // proposes *some* category for the user to accept or swap in the confirmation card.
    let category = custom ? { id: custom.id, name: custom.name } : parsed.categoryCode ? await this.systemCategory(userId, parsed.categoryCode) : null;
    if (custom) { matched.push("category"); confidence = Math.max(confidence, custom.type === "both" ? 0.86 : 0.96); }
    if (!category && parsed.type === "expense") {
      const guessed = await this.categorization.categorize(userId, text);
      if (guessed.categoryId) {
        category = await this.categoryById(userId, guessed.categoryId);
        if (category) {
          matched.push("category");
          confidence = Math.min(0.98, confidence + 0.08);
        }
      }
    }
    // Captured before the "Другое" fallback below fills `category` unconditionally —
    // requiresConfirmation used to check `!category`, which after that fallback was
    // never true, silently dropping the "no real category matched" half of the check.
    const categoryResolved = category !== null;
    category ??= await this.systemCategory(
      userId,
      parsed.type === "income" ? "other_income" : "other_expense",
    );

    const occurredAt = this.localDaysAgo(parsed.daysAgo, user?.timezone ?? "Europe/Moscow");

    return {
      type: parsed.type,
      amountMinor: parsed.amountMinor,
      currency: account?.currency ?? "RUB",
      accountId: account?.id ?? null,
      accountName: account?.name ?? null,
      categoryId: category?.id ?? null,
      categoryName: category?.name ?? null,
      occurredAt: occurredAt.toISOString(),
      confidence: Number(confidence.toFixed(2)),
      explanation: matched.map((key) => EXPLANATIONS[key] ?? key),
      description: text.replace(/\d[\d\s]*(?:[.,]\d+)?\s*(?:тыс\.?|тысяч|к)?/i, "").trim() || null,
      requiresConfirmation: confidence < 0.75 || !categoryResolved,
    };
  }

  private async accountsForUser(userId: string) {
    return this.transactions.accessibleAccounts(userId);
  }

  private localDaysAgo(daysAgo: number, timezone: string): Date {
    const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" });
    const parts = Object.fromEntries(formatter.formatToParts(new Date()).map((part) => [part.type, part.value]));
    const noonUtc = new Date(`${parts.year}-${parts.month}-${parts.day}T12:00:00.000Z`);
    noonUtc.setUTCDate(noonUtc.getUTCDate() - daysAgo);
    return noonUtc;
  }

  private async systemCategory(
    userId: string,
    systemCode: string,
  ): Promise<{ id: string; name: string } | null> {
    const [row] = await this.db
      .select({ id: categories.id, name: categories.name })
      .from(categories)
      .where(
        and(
          eq(categories.systemCode, systemCode),
          or(isNull(categories.userId), eq(categories.userId, userId)),
        ),
      );
    return row ?? null;
  }

  private async categoryById(
    userId: string,
    id: string,
  ): Promise<{ id: string; name: string } | null> {
    const [row] = await this.db
      .select({ id: categories.id, name: categories.name })
      .from(categories)
      .where(and(eq(categories.id, id), or(isNull(categories.userId), eq(categories.userId, userId))));
    return row ?? null;
  }
}
