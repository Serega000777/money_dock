import { Module } from "@nestjs/common";

import { AccountsModule } from "../accounts/accounts.module";
import { AnalyticsModule } from "../analytics/analytics.module";
import { UsersModule } from "../users/users.module";

import { InsightsController } from "./insights.controller";
import { InsightsService } from "./insights.service";

@Module({
  imports: [AccountsModule, AnalyticsModule, UsersModule],
  controllers: [InsightsController],
  providers: [InsightsService],
})
export class InsightsModule {}
