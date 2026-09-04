import type { User } from "@money-dock/shared-types";
import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, eq } from "drizzle-orm";

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
    status: row.status,
  };
}

@Injectable()
export class UsersService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

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
}
