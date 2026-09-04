import type { Category } from "@money-dock/shared-types";
import type { CreateCategoryInput } from "@money-dock/validation";
import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, eq, isNull, or } from "drizzle-orm";

import type { Database } from "../../db/client";
import { DATABASE } from "../../db/database.token";
import { firstOrThrow } from "../../db/first-or-throw";
import { categories } from "../../db/schema";

function toCategory(row: typeof categories.$inferSelect): Category {
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    parentId: row.parentId,
    icon: row.icon,
    isSystem: row.userId === null,
  };
}

@Injectable()
export class CategoriesService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async listForUser(userId: string): Promise<Category[]> {
    const rows = await this.db
      .select()
      .from(categories)
      .where(or(isNull(categories.userId), eq(categories.userId, userId)));
    return rows.map(toCategory);
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

    const rows = await this.db
      .insert(categories)
      .values({ ...input, userId })
      .returning();
    return toCategory(firstOrThrow(rows));
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
