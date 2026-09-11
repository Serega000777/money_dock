import type { AuthTokens, User } from "@money-dock/shared-types";
import type { OAuthCodeAuthInput } from "@money-dock/validation";
import {
  Injectable,
  NotFoundException,
  NotImplementedException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";

import { AuditLogService } from "../../common/audit-log.service";
import type { Env } from "../../config/env";
import { DemoDataService } from "../demo/demo-data.service";
import { UsersService } from "../users/users.service";

import { SessionsService } from "./sessions.service";
import { verifyTelegramInitData } from "./telegram-init-data";

/** Stable fake Telegram id so repeated dev logins land on the same demo user. */
const DEV_TELEGRAM_ID = 10_000_000_001;

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly sessions: SessionsService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
    private readonly demoData: DemoDataService,
    private readonly auditLog: AuditLogService,
  ) {}

  async loginWithTelegram(initData: string): Promise<{ user: User; tokens: AuthTokens }> {
    const botToken = this.config.get("TELEGRAM_BOT_TOKEN", { infer: true });
    const result = verifyTelegramInitData(initData, botToken);

    if (!result.ok) {
      throw new UnauthorizedException(`Telegram initData rejected: ${result.reason}`);
    }

    const user = await this.users.findOrCreateByTelegramIdentity(result.user);
    return this.issueSession(user, "telegram");
  }

  /**
   * Scaffolding for the Yandex ID sign-in button (spec: registration screen offers
   * Telegram / Yandex ID / VK ID). Not wired to a real Yandex OAuth app yet — there is no
   * client id/secret to exchange `code` for a token with, and no `verify-yandex-id.ts`
   * helper (the counterpart to `verifyTelegramInitData`) to turn that token into a
   * verified identity. Wiring it for real is: exchange `code` at
   * https://oauth.yandex.ru/token, call https://login.yandex.ru/info with the resulting
   * access token to get the Yandex user id/profile, then
   * `this.users.findOrCreateByIdentity("yandex", ...)` (generalize
   * `findOrCreateByTelegramIdentity` — `userIdentities` already has a `"yandex"` enum
   * value for this) and `this.issueSession(user, "yandex")`.
   */
  loginWithYandex(_input: OAuthCodeAuthInput): Promise<{ user: User; tokens: AuthTokens }> {
    throw new NotImplementedException("Вход через Yandex ID пока недоступен");
  }

  /**
   * Scaffolding for the VK ID sign-in button — same shape and same caveats as
   * {@link loginWithYandex}. Wiring it for real additionally needs a `"vk"` value on
   * `identityProviderEnum` (added alongside this stub) and VK ID's own token exchange at
   * https://id.vk.com/oauth2/auth (VK ID uses PKCE, not a plain client secret).
   */
  loginWithVk(_input: OAuthCodeAuthInput): Promise<{ user: User; tokens: AuthTokens }> {
    throw new NotImplementedException("Вход через VK ID пока недоступен");
  }

  /** Shared tail of every login path: open a session, mint an access token, audit-log. */
  private async issueSession(
    user: User,
    provider: string,
    deviceId?: string,
  ): Promise<{ user: User; tokens: AuthTokens }> {
    const { refreshToken } = await this.sessions.issue(user.id, deviceId);
    const accessToken = await this.jwt.signAsync({ sub: user.id });

    await this.auditLog.record({
      userId: user.id,
      action: "auth.login",
      entityType: "user",
      entityId: user.id,
      metadata: { provider },
    });

    return { user, tokens: { accessToken, refreshToken } };
  }

  /**
   * Signs in a fixed demo user so the app can be opened and reviewed in a plain browser,
   * outside Telegram. Hard-disabled in production — there is no code path that reaches a
   * session without a verified Telegram signature there.
   */
  async devLogin(): Promise<{ user: User; tokens: AuthTokens }> {
    if (this.config.get("NODE_ENV", { infer: true }) === "production") {
      throw new NotFoundException();
    }

    const user = await this.users.findOrCreateByTelegramIdentity({
      id: DEV_TELEGRAM_ID,
      first_name: "Демо",
      language_code: "ru",
    });
    await this.demoData.seedFor(user.id);

    return this.issueSession(user, "dev-browser", "dev-browser");
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    const rotated = await this.sessions.rotate(refreshToken);
    if (!rotated) throw new UnauthorizedException("Refresh token is invalid, expired, or revoked");

    const accessToken = await this.jwt.signAsync({ sub: rotated.userId });
    return { accessToken, refreshToken: rotated.issued.refreshToken };
  }

  async logout(refreshToken: string): Promise<void> {
    const userId = await this.sessions.revoke(refreshToken);
    if (userId) {
      await this.auditLog.record({ userId, action: "auth.logout", entityType: "user", entityId: userId });
    }
  }
}
