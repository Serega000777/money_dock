import type { SpeechTranscriptionResult } from "@money-dock/shared-types";
import { BadRequestException, Controller, Post, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Throttle } from "@nestjs/throttler";

import { JwtAuthGuard } from "../auth/jwt-auth.guard";

import { SpeechService } from "./speech.service";

@UseGuards(JwtAuthGuard)
@Controller("speech")
export class SpeechController {
  constructor(private readonly speech: SpeechService) {}

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post("transcribe")
  @UseInterceptors(FileInterceptor("audio", { limits: { fileSize: 10 * 1024 * 1024 } }))
  transcribe(@UploadedFile() file?: { buffer: Buffer; mimetype: string }): Promise<SpeechTranscriptionResult> {
    if (!file) throw new BadRequestException("Аудио не приложено");
    return this.speech.transcribe(file.buffer, file.mimetype);
  }
}
