import { createHash, randomBytes, randomUUID } from "node:crypto";
import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { and, desc, eq, gt, isNull, or } from "drizzle-orm";
import type { ShortcutCaptureInput } from "@money-dock/validation";

import type { Database } from "../../db/client";
import { DATABASE } from "../../db/database.token";
import { shortcutCredentials } from "../../db/schema";
import { CommandsService } from "../commands/commands.service";

const hash = (token: string) => createHash("sha256").update(token).digest("hex");

@Injectable()
export class ShortcutsService {
  constructor(@Inject(DATABASE) private readonly db: Database, private readonly commands: CommandsService) {}

  async list(userId: string) {
    return this.db.select({ id: shortcutCredentials.id, name: shortcutCredentials.name, createdAt: shortcutCredentials.createdAt, lastUsedAt: shortcutCredentials.lastUsedAt, revokedAt: shortcutCredentials.revokedAt, expiresAt: shortcutCredentials.expiresAt })
      .from(shortcutCredentials).where(eq(shortcutCredentials.userId, userId)).orderBy(desc(shortcutCredentials.createdAt));
  }

  async create(userId: string, name: string) {
    const token = `amola_sk_${randomBytes(32).toString("base64url")}`;
    await this.db.update(shortcutCredentials).set({ revokedAt: new Date() }).where(and(eq(shortcutCredentials.userId, userId), isNull(shortcutCredentials.revokedAt)));
    const [row] = await this.db.insert(shortcutCredentials).values({ userId, name, tokenHash: hash(token) }).returning();
    return { id: row!.id, token, name: row!.name, createdAt: row!.createdAt.toISOString() };
  }

  async revoke(userId: string, id: string) {
    await this.db.update(shortcutCredentials).set({ revokedAt: new Date() }).where(and(eq(shortcutCredentials.id, id), eq(shortcutCredentials.userId, userId)));
  }

  async authenticate(token: string): Promise<string> {
    const now = new Date();
    // gt(), not a raw sql`... > ${now}` template — interpolating a plain Date into raw
    // sql skips drizzle's column-aware parameter binding, and postgres.js was sending
    // Postgres the JS Date's locale string (e.g. "Thu Sep 24 2026 ... (GMT-0400)"),
    // which it can't parse as a timestamp, so every request with an expiring credential
    // 500'd instead of authenticating.
    const [credential] = await this.db.select().from(shortcutCredentials).where(and(eq(shortcutCredentials.tokenHash, hash(token)), isNull(shortcutCredentials.revokedAt), or(isNull(shortcutCredentials.expiresAt), gt(shortcutCredentials.expiresAt, now))));
    if (!credential) throw new UnauthorizedException("Invalid or revoked Shortcut token");
    await this.db.update(shortcutCredentials).set({ lastUsedAt: now }).where(eq(shortcutCredentials.id, credential.id));
    return credential.userId;
  }

  async capture(userId: string, input: ShortcutCaptureInput) {
    // A client that can't build its own UUID (most generic Android "HTTP request"
    // shortcut apps) just omits it — this only costs that one request retry-safety, not
    // correctness, since a fresh id here can never collide with a real duplicate.
    const clientRequestId = input.clientRequestId ?? randomUUID();
    const tx = await this.commands.capture(userId, input.input, input.mode, clientRequestId, input.walletId, "shortcut");
    const sign = tx.type === "income" ? "+" : "−";
    return { success: true, transaction: tx, message: `${sign}${new Intl.NumberFormat("ru-RU").format(tx.amountMinor / 100)} ₽` };
  }
}
