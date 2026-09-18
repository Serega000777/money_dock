import { Body, Controller, Delete, Get, Headers, Param, ParseUUIDPipe, Post, UnauthorizedException, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { createShortcutCredentialSchema, shortcutCaptureSchema, type ShortcutCaptureInput } from "@money-dock/validation";
import { CurrentUser } from "../../common/current-user.decorator";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import type { AuthenticatedUser } from "../auth/authenticated-request";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ShortcutsService } from "./shortcuts.service";

@Controller("shortcut-credentials")
@UseGuards(JwtAuthGuard)
export class ShortcutCredentialsController {
  constructor(private readonly shortcuts: ShortcutsService) {}
  @Get() list(@CurrentUser() user: AuthenticatedUser) { return this.shortcuts.list(user.id); }
  @Post() create(@CurrentUser() user: AuthenticatedUser, @Body(new ZodValidationPipe(createShortcutCredentialSchema)) body: { name: string }) { return this.shortcuts.create(user.id, body.name); }
  @Delete(":id") revoke(@CurrentUser() user: AuthenticatedUser, @Param("id", ParseUUIDPipe) id: string) { return this.shortcuts.revoke(user.id, id); }
}

@Controller("shortcut")
export class ShortcutCaptureController {
  constructor(private readonly shortcuts: ShortcutsService) {}
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post("transactions")
  async capture(@Headers("authorization") authorization: string | undefined, @Body(new ZodValidationPipe(shortcutCaptureSchema)) body: ShortcutCaptureInput) {
    const token = authorization?.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
    if (!token) throw new UnauthorizedException("Missing Shortcut token");
    return this.shortcuts.capture(await this.shortcuts.authenticate(token), body);
  }
}
