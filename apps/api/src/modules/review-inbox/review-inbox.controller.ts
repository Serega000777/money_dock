import { reviewResolveSchema, type ReviewResolveInput } from "@money-dock/validation";
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from "@nestjs/common";

import { CurrentUser } from "../../common/current-user.decorator";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import type { AuthenticatedUser } from "../auth/authenticated-request";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

import { ReviewInboxService, type ReviewInboxItem } from "./review-inbox.service";

@UseGuards(JwtAuthGuard)
@Controller("review-inbox")
export class ReviewInboxController {
  constructor(private readonly reviewInbox: ReviewInboxService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser): Promise<ReviewInboxItem[]> {
    return this.reviewInbox.listPending(user.id);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Post(":id/resolve")
  resolve(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(reviewResolveSchema)) body: ReviewResolveInput,
  ): Promise<void> {
    return this.reviewInbox.resolve(user.id, id, body.action, body.categoryId);
  }
}
