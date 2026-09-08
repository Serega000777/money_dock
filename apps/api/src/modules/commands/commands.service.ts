import { CommandParseError, parseCommand } from "@money-dock/business-rules";
import type { CurrencyCode, Transaction } from "@money-dock/shared-types";
import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { and, eq, isNull, or } from "drizzle-orm";

import type { Database } from "../../db/client";
import { DATABASE } from "../../db/database.token";
import { accounts, categories, reviewItems } from "../../db/schema";
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

    let category: { id: string; name: string } | null = null;
    if (parsed.categoryCode) {
      const [row] = await this.db
        .select({ id: categories.id, name: categories.name })
        .from(categories)
        .where(
          and(
            eq(categories.systemCode, parsed.categoryCode),
            or(isNull(categories.userId), eq(categories.userId, userId)),
          ),
        );
      category = row ?? null;
    }

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
      confidence: parsed.confidence,
      explanation: parsed.matched.map((key) => EXPLANATIONS[key] ?? key),
    };
  }
}
