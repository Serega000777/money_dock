import { randomBytes, createHash } from "node:crypto";

import { Inject, Injectable } from "@nestjs/common";
import { and, eq, isNull } from "drizzle-orm";

import type { Database } from "../../db/client";
import { DATABASE } from "../../db/database.token";
import { firstOrThrow } from "../../db/first-or-throw";
import { sessions } from "../../db/schema";

const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface IssuedSession {
  sessionId: string;
  refreshToken: string;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

@Injectable()
export class SessionsService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async issue(userId: string, deviceId?: string): Promise<IssuedSession> {
    const refreshToken = randomBytes(32).toString("hex");
    const rows = await this.db
      .insert(sessions)
      .values({
        userId,
        refreshTokenHash: hashToken(refreshToken),
        deviceId,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      })
      .returning({ id: sessions.id });

    return { sessionId: firstOrThrow(rows).id, refreshToken };
  }

  /** Rotates a valid refresh token: revokes it and issues a fresh one for the same user. */
  async rotate(refreshToken: string): Promise<{ userId: string; issued: IssuedSession } | null> {
    const tokenHash = hashToken(refreshToken);
    const now = new Date();

    const [session] = await this.db
      .select()
      .from(sessions)
      .where(and(eq(sessions.refreshTokenHash, tokenHash), isNull(sessions.revokedAt)));

    if (!session || session.expiresAt < now) return null;

    await this.db.update(sessions).set({ revokedAt: now }).where(eq(sessions.id, session.id));

    const issued = await this.issue(session.userId, session.deviceId ?? undefined);
    return { userId: session.userId, issued };
  }

  async revoke(refreshToken: string): Promise<void> {
    const tokenHash = hashToken(refreshToken);
    await this.db
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(and(eq(sessions.refreshTokenHash, tokenHash), isNull(sessions.revokedAt)));
  }
}
