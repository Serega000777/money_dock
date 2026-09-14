import { CommandParseError, parseCommand } from "@money-dock/business-rules";
import type { CurrencyCode, Transaction } from "@money-dock/shared-types";
import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { and, eq, isNull, or } from "drizzle-orm";

import type { Database } from "../../db/client";
import { DATABASE } from "../../db/database.token";
import { accounts, categories, reviewItems } from "../../db/schema";
import { CategorizationService } from "../categorization/categorization.service";
import { EntitlementsService } from "../entitlements/entitlements.service";
import { TransactionsService } from "../transactions/transactions.service";

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
  ) {}

  /**
   * Hands-free capture for Siri and the home-screen widget: the phrase is never shown
   * back before saving, so the transaction is stored as needs_review and queued in the
   * Review Inbox. Opening the app is what turns it into a confirmed operation.
   */
  async capture(
    userId: string,
    text: string,
    source: "voice" | "text",
    clientId: string,
  ): Promise<Transaction> {
    const draft = await this.parse(userId, text, source);
    if (!draft.accountId) throw new BadRequestException("Сначала добавьте счёт");

    const transaction = await this.transactions.create(
      userId,
      {
        type: draft.type,
        accountId: draft.accountId,
        categoryId: draft.categoryId ?? undefined,
        amountMinor: draft.amountMinor,
        currency: draft.currency as CurrencyCode,
        occurredAt: draft.occurredAt,
        note: text,
        clientId,
      },
      { source: "voice", status: "needs_review" },
    );

    await this.db.insert(reviewItems).values({
      userId,
      transactionId: transaction.id,
      reason: "unconfirmed_capture",
      confidence: Math.round(draft.confidence * 100),
      suggestedJson: draft.categoryId ? { categoryId: draft.categoryId } : null,
    });

    return transaction;
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

    const userAccounts = await this.db
      .select()
      .from(accounts)
      .where(and(eq(accounts.userId, userId), isNull(accounts.archivedAt)));

    // Prefer the account type the user named; otherwise fall back to their first account.
    const account =
      (parsed.accountType && userAccounts.find((a) => a.type === parsed.accountType)) ||
      userAccounts[0] ||
      null;

    const matched = [...parsed.matched];
    let confidence = parsed.confidence;

    // The parser's own keyword hints first; then, for expenses, the same pipeline a bank
    // statement goes through (the user's own rules and history, brand aliases, the local
    // classifier) run over the whole phrase — "яндекс такси" or "вкусвилл" are brands
    // the parser deliberately doesn't know; and finally "Другое", so the draft always
    // proposes *some* category for the user to accept or swap in the confirmation card.
    let category = parsed.categoryCode ? await this.systemCategory(userId, parsed.categoryCode) : null;
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
    category ??= await this.systemCategory(
      userId,
      parsed.type === "income" ? "other_income" : "other_expense",
    );

    const occurredAt = new Date(Date.now() - parsed.daysAgo * 86_400_000);

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
    };
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
