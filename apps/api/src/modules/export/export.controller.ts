import { Controller, HttpCode, HttpStatus, Post, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";

import { CurrentUser } from "../../common/current-user.decorator";
import type { AuthenticatedUser } from "../auth/authenticated-request";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

import { ExportService } from "./export.service";

@UseGuards(JwtAuthGuard)
@Controller("exports")
export class ExportController {
  constructor(private readonly exportService: ExportService) {}

  /** Rate-limited (spec §11: export endpoints must be) — this is a full-account dump. */
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post()
  create(@CurrentUser() user: AuthenticatedUser) {
    return this.exportService.exportAll(user.id);
  }
}
