import type { Debt } from "@money-dock/shared-types";
import {
  createDebtSchema,
  updateDebtSchema,
  type CreateDebtInput,
  type UpdateDebtInput,
} from "@money-dock/validation";
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";

import { CurrentUser } from "../../common/current-user.decorator";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import type { AuthenticatedUser } from "../auth/authenticated-request";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

import { DebtsService } from "./debts.service";

@UseGuards(JwtAuthGuard)
@Controller("debts")
export class DebtsController {
  constructor(private readonly debts: DebtsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser): Promise<Debt[]> {
    return this.debts.list(user.id);
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createDebtSchema)) body: CreateDebtInput,
  ): Promise<Debt> {
    return this.debts.create(user.id, body);
  }

  @Patch(":id")
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateDebtSchema)) body: UpdateDebtInput,
  ): Promise<Debt> {
    return this.debts.update(user.id, id, body);
  }

  @Post(":id/settle")
  settle(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<Debt> {
    return this.debts.setSettled(user.id, id, true);
  }

  @Post(":id/unsettle")
  unsettle(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<Debt> {
    return this.debts.setSettled(user.id, id, false);
  }

  @Delete(":id")
  @HttpCode(204)
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.debts.remove(user.id, id);
  }
}
