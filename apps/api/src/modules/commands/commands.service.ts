import { CommandParseError, parseCommand } from "@money-dock/business-rules";
import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { and, eq, isNull, or } from "drizzle-orm";

import type { Database } from "../../db/client";
import { DATABASE } from "../../db/database.token";
import { accounts, categories } from "../../db/schema";
import { EntitlementsService } from "../entitlements/entitlements.service";

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
  ) {}

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
