import { Module } from "@nestjs/common";

import { EntitlementsModule } from "../entitlements/entitlements.module";
import { UsersModule } from "../users/users.module";

import { PaymentsController } from "./payments.controller";
import { TelegramBotController } from "./telegram-bot.controller";
import { TelegramBotService } from "./telegram-bot.service";

@Module({
  imports: [UsersModule, EntitlementsModule],
  controllers: [TelegramBotController, PaymentsController],
  providers: [TelegramBotService],
})
export class TelegramBotModule {}
