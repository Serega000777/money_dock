import { Module } from "@nestjs/common";

import { AnalyticsModule } from "../analytics/analytics.module";
import { UsersModule } from "../users/users.module";

import { InsightsController } from "./insights.controller";
import { InsightsService } from "./insights.service";

@Module({
  imports: [AnalyticsModule, UsersModule],
  controllers: [InsightsController],
  providers: [InsightsService],
})
export class InsightsModule {}
