import type { AssistantAction, AssistantConversation, AssistantMessage, AssistantResponse } from "@money-dock/shared-types";
import {
  createAssistantConversationSchema,
  sendAssistantMessageSchema,
  type CreateAssistantConversationInput,
  type SendAssistantMessageInput,
} from "@money-dock/validation";
import { BadRequestException, Body, Controller, Get, HttpCode, HttpStatus, Param, Post, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Throttle } from "@nestjs/throttler";

import { CurrentUser } from "../../common/current-user.decorator";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import type { AuthenticatedUser } from "../auth/authenticated-request";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { SpeechService } from "../speech/speech.service";

import { AssistantService } from "./assistant.service";

@UseGuards(JwtAuthGuard)
@Controller("assistant")
export class AssistantController {
  constructor(
    private readonly assistant: AssistantService,
    private readonly speech: SpeechService,
  ) {}

  @Post("conversations")
  createConversation(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createAssistantConversationSchema)) body: CreateAssistantConversationInput,
  ): Promise<AssistantConversation> {
    return this.assistant.createConversation(user.id, body.title);
  }

  @Get("conversations")
  listConversations(@CurrentUser() user: AuthenticatedUser): Promise<AssistantConversation[]> {
    return this.assistant.listConversations(user.id);
  }

  @Get("conversations/:id")
  getConversation(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ): Promise<AssistantConversation> {
    return this.assistant.getConversation(user.id, id);
  }

  @Get("conversations/:id/messages")
  listMessages(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ): Promise<AssistantMessage[]> {
    return this.assistant.listMessages(user.id, id);
  }

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post("conversations/:id/messages")
  sendMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(sendAssistantMessageSchema)) body: SendAssistantMessageInput,
  ): Promise<AssistantResponse> {
    return this.assistant.sendMessage(user.id, id, body.text, body.inputType);
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post("voice")
  @UseInterceptors(FileInterceptor("audio", { limits: { fileSize: 10 * 1024 * 1024 } }))
  async sendVoice(
    @CurrentUser() user: AuthenticatedUser,
    @Body("conversationId") conversationId?: string,
    @UploadedFile() file?: { buffer: Buffer; mimetype: string },
  ): Promise<AssistantResponse> {
    if (!conversationId) throw new BadRequestException("Не указан разговор");
    if (!file) throw new BadRequestException("Аудио не приложено");
    const { text } = await this.speech.transcribe(file.buffer, file.mimetype);
    return this.assistant.sendMessage(user.id, conversationId, text, "voice");
  }

  @HttpCode(HttpStatus.OK)
  @Post("actions/:id/confirm")
  confirm(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ): Promise<AssistantAction> {
    return this.assistant.confirmAction(user.id, id);
  }

  @HttpCode(HttpStatus.OK)
  @Post("actions/:id/cancel")
  cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ): Promise<AssistantAction> {
    return this.assistant.cancelAction(user.id, id);
  }
}
