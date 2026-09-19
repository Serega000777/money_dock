import { Controller, Get, Post, UseGuards } from "@nestjs/common";

import { CurrentUser } from "../../common/current-user.decorator";
import type { AuthenticatedUser } from "../auth/authenticated-request";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

import { PRO_MONTHLY_STARS, TelegramBotService } from "./telegram-bot.service";

/**
 * Telegram Stars is the one payment method the app can actually charge with today — it
 * runs entirely through the Bot API already wired up for the bot, no external payment
 * gateway account to set up. The purchase screen's other listed methods (SBP, card,
 * YooKassa/Tinkoff/Yandex Pay) have no real provider behind them yet and stay "скоро".
 */
@Controller("payments")
@UseGuards(JwtAuthGuard)
export class PaymentsController {
  constructor(private readonly telegramBot: TelegramBotService) {}

  @Get("pricing")
  pricing(): { starsMonthly: number } {
    return { starsMonthly: PRO_MONTHLY_STARS };
  }

  @Post("stars/invoice-link")
  async starsInvoiceLink(@CurrentUser() user: AuthenticatedUser): Promise<{ url: string }> {
    return { url: await this.telegramBot.createStarsInvoiceLink(user.id) };
  }
}
