import { Controller, Get, UseGuards } from "@nestjs/common";

import { CurrentUser } from "../../common/current-user.decorator";
import type { AuthenticatedUser } from "../auth/authenticated-request";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

import { EntitlementsService, type Entitlements } from "./entitlements.service";

@UseGuards(JwtAuthGuard)
@Controller("entitlements")
export class EntitlementsController {
  constructor(private readonly entitlements: EntitlementsService) {}

  @Get()
  get(@CurrentUser() user: AuthenticatedUser): Promise<Entitlements> {
    return this.entitlements.getEntitlements(user.id);
  }
}
