import { normalizeMerchant } from "@money-dock/business-rules";
import type { Category } from "@money-dock/shared-types";
import type { CreateCategoryInput } from "@money-dock/validation";
import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, eq, isNull, or } from "drizzle-orm";

import type { Database } from "../../db/client";
import { DATABASE } from "../../db/database.token";
import { firstOrThrow } from "../../db/first-or-throw";
import { categories, categoryRules } from "../../db/schema";

function toCategory(row: typeof categories.$inferSelect, aliases: string[] = []): Category {
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    parentId: row.parentId,
    icon: row.icon,
    color: row.color,
    systemCode: row.systemCode,
    isSystem: row.userId === null,
    aliases,
  };
}

@Injectable()
export class CategoriesService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async listForUser(userId: string): Promise<Category[]> {
    const [rows, rules] = await Promise.all([this.db
      .select()
      .from(categories)
      .where(or(isNull(categories.userId), eq(categories.userId, userId))),
      this.db.select().from(categoryRules).where(and(eq(categoryRules.userId, userId), eq(categoryRules.active, true))),
    ]);
    return rows.map((row) => toCategory(row, rules.filter((rule) => rule.categoryId === row.id).map((rule) => rule.pattern)));
  }

  async create(userId: string, input: CreateCategoryInput): Promise<Category> {
    if (input.parentId) {
      const [parent] = await this.db
        .select()
        .from(categories)
        .where(
          and(
            eq(categories.id, input.parentId),
            or(isNull(categories.userId), eq(categories.userId, userId)),
          ),
        );
      if (!parent) throw new BadRequestException("Parent category not found");
      if (parent.type !== input.type) {
        throw new BadRequestException("Parent category must have the same type");
      }
    }

    const { aliases, ...categoryInput } = input;
    return this.db.transaction(async (tx) => {
      const rows = await tx.insert(categories).values({ ...categoryInput, userId }).returning();
      const row = firstOrThrow(rows);
      // Same normalizer CommandsService.parse() matches phrases against, and the one
      // statement-import matching already reads category_rules with (business-rules'
      // normalizeMerchant) — a different hand-rolled version here previously wrote
      // patterns the parser could never match back. Patterns under 2 characters are
      // dropped: a single letter would match almost any phrase.
      const patterns = [...new Set([input.name, ...aliases].map(normalizeMerchant))].filter(
        (pattern) => pattern.length >= 2,
      );
      if (patterns.length) {
        // onConflictDoNothing: a pattern already claimed by an existing rule (a personal
        // correction learned earlier, or another of this user's categories) keeps
        // pointing at whatever it already resolves to rather than being silently
        // reassigned here.
        await tx
          .insert(categoryRules)
          .values(patterns.map((pattern) => ({ userId, categoryId: row.id, pattern })))
          .onConflictDoNothing();
      }
      // Read back what's actually attached to this category — some of `patterns` may
      // have lost the onConflictDoNothing race above, and the response must reflect
      // reality, not just echo the input back.
      const savedRules = await tx
        .select({ pattern: categoryRules.pattern })
        .from(categoryRules)
        .where(and(eq(categoryRules.userId, userId), eq(categoryRules.categoryId, row.id)));
      return toCategory(
        row,
        savedRules.map((rule) => rule.pattern),
      );
    });
  }

  /** System categories (userId is null) never match here — they can't be deleted. */
  async deleteOwn(userId: string, id: string): Promise<void> {
    const deleted = await this.db
      .delete(categories)
      .where(and(eq(categories.id, id), eq(categories.userId, userId)))
      .returning({ id: categories.id });
    if (deleted.length === 0) throw new NotFoundException("Category not found");
  }
}
