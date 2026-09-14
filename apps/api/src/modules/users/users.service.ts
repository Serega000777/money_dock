import type { User } from "@money-dock/shared-types";
import type { UpdateMeInput } from "@money-dock/validation";
import { Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { and, eq } from "drizzle-orm";

import { AuditLogService } from "../../common/audit-log.service";
import type { Database } from "../../db/client";
import { DATABASE } from "../../db/database.token";
import { firstOrThrow } from "../../db/first-or-throw";
import { userIdentities, users } from "../../db/schema";
import type { TelegramInitDataUser } from "../auth/telegram-init-data";

function toUser(row: typeof users.$inferSelect): User {
  return {
    id: row.id,
    displayName: row.displayName,
    baseCurrency: row.baseCurrency as User["baseCurrency"],
    timezone: row.timezone,
    locale: row.locale,
    avatarUrl: row.avatarUrl,
    status: row.status,
  };
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly auditLog: AuditLogService,
  ) {}

  async findOrCreateByTelegramIdentity(telegramUser: TelegramInitDataUser): Promise<User> {
    const providerUserId = String(telegramUser.id);

    const [existing] = await this.db
      .select({ user: users })
      .from(userIdentities)
      .innerJoin(users, eq(users.id, userIdentities.userId))
      .where(
        and(
          eq(userIdentities.provider, "telegram"),
          eq(userIdentities.providerUserId, providerUserId),
        ),
      );

    if (existing) return toUser(existing.user);

    return this.db.transaction(async (tx) => {
      const displayName = [telegramUser.first_name, telegramUser.last_name]
        .filter(Boolean)
        .join(" ");

      const createdUser = firstOrThrow(
        await tx
          .insert(users)
          .values({
            displayName: displayName || `user${providerUserId}`,
            locale: telegramUser.language_code?.startsWith("ru") ? "ru" : "en",
          })
          .returning(),
      );

      await tx.insert(userIdentities).values({
        userId: createdUser.id,
        provider: "telegram",
        providerUserId,
        verifiedAt: new Date(),
      });

      return toUser(createdUser);
    });
  }

  async getById(id: string): Promise<User> {
    const [row] = await this.db.select().from(users).where(eq(users.id, id));
    if (!row) throw new NotFoundException("User not found");
    return toUser(row);
  }

  async updateProfile(userId: string, input: UpdateMeInput): Promise<User> {
    await this.getById(userId);
    const rows = await this.db
      .update(users)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return toUser(firstOrThrow(rows));
  }

  /**
   * Deletes the account and, via `onDelete: cascade`, everything it owns (spec §34:
   * "Удаление аккаунта доступно"). The audit-log row is written first, but — like every
   * other user-owned row — it cascades away with the user it references, so the durable
   * trail of *that specific* deletion is this log line, not the DB.
   */
  async deleteAccount(userId: string): Promise<void> {
    await this.getById(userId);
    await this.auditLog.record({ userId, action: "account.delete", entityType: "user", entityId: userId });
    this.logger.warn(`Account deleted: user=${userId}`);
    await this.db.delete(users).where(eq(users.id, userId));
  }
}
