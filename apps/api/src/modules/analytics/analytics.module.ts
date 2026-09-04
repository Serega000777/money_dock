import { Module } from "@nestjs/common";

import { AccountsModule } from "../accounts/accounts.module";
import { UsersModule } from "../users/users.module";

import { AnalyticsController } from "./analytics.controller";
import { AnalyticsService } from "./analytics.service";

@Module({
  imports: [AccountsModule, UsersModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
})
export class AnalyticsModule {}
