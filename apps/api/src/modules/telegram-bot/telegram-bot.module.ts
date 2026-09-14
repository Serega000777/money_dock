import { Module } from "@nestjs/common";

import { UsersModule } from "../users/users.module";

import { TelegramBotController } from "./telegram-bot.controller";
import { TelegramBotService } from "./telegram-bot.service";

@Module({
  imports: [UsersModule],
  controllers: [TelegramBotController],
  providers: [TelegramBotService],
})
export class TelegramBotModule {}
