import { Body, Controller, Headers, HttpCode, HttpStatus, Post, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import type { Env } from "../../config/env";

import { TelegramBotService } from "./telegram-bot.service";
import type { TelegramUpdate } from "./telegram-update";

@Controller("telegram")
export class TelegramBotController {
  constructor(
    private readonly bot: TelegramBotService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /**
   * Telegram calls this directly (registered once via setWebhook — see
   * scripts/set-telegram-webhook.ts), not through JwtAuthGuard: there's no user token on
   * a webhook call, only the shared secret Telegram echoes back on every request. Always
   * 200s — a non-2xx response makes Telegram retry the same update, and a transient
   * failure to reach api.telegram.org for the *reply* (handled inside the service) isn't
   * a reason to also fail the *delivery*.
   */
  @HttpCode(HttpStatus.OK)
  @Post("webhook")
  async webhook(
    @Body() update: TelegramUpdate,
    @Headers("x-telegram-bot-api-secret-token") secretHeader: string | undefined,
  ): Promise<{ ok: true }> {
    const expected = this.config.get("TELEGRAM_WEBHOOK_SECRET", { infer: true });
    if (!expected || secretHeader !== expected) {
      throw new UnauthorizedException();
    }
    await this.bot.handleUpdate(update);
    return { ok: true };
  }
}
