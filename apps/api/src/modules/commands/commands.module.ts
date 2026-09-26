import { Module } from "@nestjs/common";

import { CategorizationModule } from "../categorization/categorization.module";
import { EntitlementsModule } from "../entitlements/entitlements.module";
import { TransactionsModule } from "../transactions/transactions.module";

import { CommandsController } from "./commands.controller";
import { CommandsService } from "./commands.service";
import { TranscriptionService } from "./transcription.service";

@Module({
  imports: [CategorizationModule, EntitlementsModule, TransactionsModule],
  controllers: [CommandsController],
  providers: [CommandsService, TranscriptionService],
  exports: [CommandsService],
})
export class CommandsModule {}
