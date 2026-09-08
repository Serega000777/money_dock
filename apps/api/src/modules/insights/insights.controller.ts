import { Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, UseGuards } from "@nestjs/common";

import { CurrentUser } from "../../common/current-user.decorator";
import type { AuthenticatedUser } from "../auth/authenticated-request";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

import type { DailySummary, InsightItem } from "./insights.service";
import { InsightsService } from "./insights.service";

@UseGuards(JwtAuthGuard)
@Controller("insights")
export class InsightsController {
  constructor(private readonly insights: InsightsService) {}

  @Get("daily-summary")
  dailySummary(@CurrentUser() user: AuthenticatedUser): Promise<DailySummary> {
    return this.insights.getDailySummary(user.id);
  }

  @Get()
  list(@CurrentUser() user: AuthenticatedUser): Promise<InsightItem[]> {
    return this.insights.listInsights(user.id);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Post(":id/read")
  markRead(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.insights.markRead(user.id, id);
  }
}
