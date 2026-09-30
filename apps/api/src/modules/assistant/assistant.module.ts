import { Module } from "@nestjs/common";

import { AnalyticsModule } from "../analytics/analytics.module";
import { CommandsModule } from "../commands/commands.module";
import { EntitlementsModule } from "../entitlements/entitlements.module";
import { TransactionsModule } from "../transactions/transactions.module";
import { SpeechModule } from "../speech/speech.module";

import { AssistantController } from "./assistant.controller";
import { AssistantService } from "./assistant.service";
import { DeepSeekProvider } from "./llm/deepseek.provider";
import { GigaChatProvider } from "./llm/gigachat.provider";
import { LlmRouterService } from "./llm/llm-router.service";

@Module({
  imports: [AnalyticsModule, CommandsModule, EntitlementsModule, TransactionsModule, SpeechModule],
  controllers: [AssistantController],
  providers: [AssistantService, DeepSeekProvider, GigaChatProvider, LlmRouterService],
  exports: [AssistantService],
})
export class AssistantModule {}
