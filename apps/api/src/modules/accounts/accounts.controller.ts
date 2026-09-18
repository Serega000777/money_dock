import type { Account, AccountInvitePreview, AccountMember } from "@money-dock/shared-types";
import {
  createAccountInviteSchema,
  createAccountSchema,
  updateAccountSchema,
  type CreateAccountInput,
  type UpdateAccountInput,
  type CreateAccountInviteInput,
  updateAccountMemberSchema,
  type UpdateAccountMemberInput,
} from "@money-dock/validation";
import {
  Body,
  Controller,
  Delete,
  Get,
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

import { AccountsService } from "./accounts.service";

@UseGuards(JwtAuthGuard)
@Controller("accounts")
export class AccountsController {
  constructor(private readonly accounts: AccountsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser): Promise<Account[]> {
    return this.accounts.list(user.id);
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createAccountSchema)) body: CreateAccountInput,
  ): Promise<Account> {
    return this.accounts.create(user.id, body);
  }

  @Get(":id")
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<Account> {
    return this.accounts.getOwned(user.id, id);
  }

  @Patch(":id")
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateAccountSchema)) body: UpdateAccountInput,
  ): Promise<Account> {
    return this.accounts.update(user.id, id, body);
  }

  @Delete(":id")
  archive(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.accounts.archive(user.id, id);
  }

  @Get(":id/members")
  members(@CurrentUser() user: AuthenticatedUser, @Param("id", ParseUUIDPipe) id: string): Promise<AccountMember[]> {
    return this.accounts.members(user.id, id);
  }

  @Post(":id/invites")
  invite(@CurrentUser() user: AuthenticatedUser, @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(createAccountInviteSchema)) body: CreateAccountInviteInput) {
    return this.accounts.createInvite(user.id, id, body);
  }

  @Delete(":id/invites/:inviteId")
  revokeInvite(@CurrentUser() user: AuthenticatedUser, @Param("id", ParseUUIDPipe) id: string, @Param("inviteId", ParseUUIDPipe) inviteId: string) {
    return this.accounts.revokeInvite(user.id, id, inviteId);
  }

  @Patch(":id/members/:memberId")
  updateMember(@CurrentUser() user: AuthenticatedUser, @Param("id", ParseUUIDPipe) id: string, @Param("memberId", ParseUUIDPipe) memberId: string,
    @Body(new ZodValidationPipe(updateAccountMemberSchema)) body: UpdateAccountMemberInput) {
    return this.accounts.updateMember(user.id, id, memberId, body.role);
  }

  @Delete(":id/members/:memberId")
  removeMember(@CurrentUser() user: AuthenticatedUser, @Param("id", ParseUUIDPipe) id: string, @Param("memberId", ParseUUIDPipe) memberId: string) {
    return this.accounts.removeMember(user.id, id, memberId);
  }

  @Get("invites/:token/preview")
  preview(@Param("token") token: string): Promise<AccountInvitePreview> { return this.accounts.invitePreview(token); }

  @Post("invites/:token/accept")
  accept(@CurrentUser() user: AuthenticatedUser, @Param("token") token: string): Promise<Account> { return this.accounts.acceptInvite(user.id, token); }
}
