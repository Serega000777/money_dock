import type { SavingsGoal } from "@money-dock/shared-types";
import {
  contributeGoalSchema,
  createGoalSchema,
  type ContributeGoalInput,
  type CreateGoalInput,
} from "@money-dock/validation";
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from "@nestjs/common";

import { CurrentUser } from "../../common/current-user.decorator";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import type { AuthenticatedUser } from "../auth/authenticated-request";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

import { GoalsService } from "./goals.service";

@UseGuards(JwtAuthGuard)
@Controller("goals")
export class GoalsController {
  constructor(private readonly goals: GoalsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser): Promise<SavingsGoal[]> {
    return this.goals.list(user.id);
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createGoalSchema)) body: CreateGoalInput,
  ): Promise<SavingsGoal> {
    return this.goals.create(user.id, body);
  }

  @Post(":id/contribute")
  contribute(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(contributeGoalSchema)) body: ContributeGoalInput,
  ): Promise<SavingsGoal> {
    return this.goals.contribute(user.id, id, body);
  }

  @Delete(":id")
  @HttpCode(204)
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.goals.remove(user.id, id);
  }
}
