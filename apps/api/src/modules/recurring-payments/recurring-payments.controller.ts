import type { RecurringPayment, Transaction } from "@money-dock/shared-types";
import {
  createRecurringPaymentSchema,
  type CreateRecurringPaymentInput,
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

import { RecurringPaymentsService } from "./recurring-payments.service";

@UseGuards(JwtAuthGuard)
@Controller("recurring-payments")
export class RecurringPaymentsController {
  constructor(private readonly recurringPayments: RecurringPaymentsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser): Promise<RecurringPayment[]> {
    return this.recurringPayments.list(user.id);
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createRecurringPaymentSchema)) body: CreateRecurringPaymentInput,
  ): Promise<RecurringPayment> {
    return this.recurringPayments.create(user.id, body);
  }

  @Post(":id/pay")
  pay(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<{ payment: RecurringPayment; transaction: Transaction }> {
    return this.recurringPayments.pay(user.id, id);
  }

  @Delete(":id")
  @HttpCode(204)
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.recurringPayments.remove(user.id, id);
  }
}
