import { parseCommandSchema, type ParseCommandInput } from "@money-dock/validation";
import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";

import { CurrentUser } from "../../common/current-user.decorator";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import type { AuthenticatedUser } from "../auth/authenticated-request";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

import { CommandsService, type CommandDraft } from "./commands.service";

@UseGuards(JwtAuthGuard)
@Controller("commands")
export class CommandsController {
  constructor(private readonly commands: CommandsService) {}

  /** Returns a draft for confirmation — never writes a transaction. */
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post("parse")
  parse(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(parseCommandSchema)) body: ParseCommandInput,
  ): Promise<CommandDraft> {
    return this.commands.parse(user.id, body.text, body.source);
  }
}
