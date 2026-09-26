import type { Transaction } from "@money-dock/shared-types";
import {
  captureCommandSchema,
  parseCommandSchema,
  type CaptureCommandInput,
  type ParseCommandInput,
} from "@money-dock/validation";
import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Throttle } from "@nestjs/throttler";

import { CurrentUser } from "../../common/current-user.decorator";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import type { AuthenticatedUser } from "../auth/authenticated-request";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

import { CommandsService, type CommandDraft } from "./commands.service";

/** Only the two fields transcription actually reads — avoids depending on multer's
 * global namespace augmentation, same call as ImportController's UploadedStatementFile. */
export interface UploadedAudioFile {
  buffer: Buffer;
  mimetype: string;
}

// A held-mic recording of one spoken command is a few seconds — generous headroom
// without leaving the endpoint open to arbitrarily large uploads.
const MAX_AUDIO_BYTES = 10 * 1024 * 1024;

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

  /** Same result as `parse`, from a recorded clip instead of browser-recognized text —
   * the path a client with no `SpeechRecognition` (every iOS browser) has to take
   * instead. Also returns a draft for confirmation; nothing is saved yet. */
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post("transcribe")
  @UseInterceptors(FileInterceptor("audio", { limits: { fileSize: MAX_AUDIO_BYTES } }))
  transcribe(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file?: UploadedAudioFile,
  ): Promise<CommandDraft> {
    if (!file) throw new BadRequestException("Аудио не приложено");
    return this.commands.parseAudio(user.id, file.buffer, file.mimetype);
  }

  /** Saves straight away, unconfirmed — for Siri and the widget, which have no UI. */
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @HttpCode(HttpStatus.CREATED)
  @Post("capture")
  capture(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(captureCommandSchema)) body: CaptureCommandInput,
  ): Promise<Transaction> {
    return this.commands.capture(user.id, body.text, body.source, body.clientId);
  }
}
