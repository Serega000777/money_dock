import type { AdminStats, AdminUserSummary } from "@money-dock/shared-types";
import {
  grantSubscriptionSchema,
  searchUsersSchema,
  type GrantSubscriptionInput,
  type SearchUsersInput,
} from "@money-dock/validation";
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";

import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

import { AdminGuard } from "./admin.guard";
import { AdminService } from "./admin.service";

@UseGuards(JwtAuthGuard, AdminGuard)
@Controller("admin")
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get("stats")
  stats(): Promise<AdminStats> {
    return this.admin.getStats();
  }

  @Get("users")
  searchUsers(
    @Query(new ZodValidationPipe(searchUsersSchema)) query: SearchUsersInput,
  ): Promise<AdminUserSummary[]> {
    return this.admin.searchUsers(query);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Post("users/:id/subscription")
  grantSubscription(
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(grantSubscriptionSchema)) body: GrantSubscriptionInput,
  ): Promise<void> {
    return this.admin.grantSubscription(id, body);
  }
}
