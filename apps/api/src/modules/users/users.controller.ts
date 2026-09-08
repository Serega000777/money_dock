import type { User } from "@money-dock/shared-types";
import { Controller, Delete, Get, HttpCode, HttpStatus, UseGuards } from "@nestjs/common";

import { CurrentUser } from "../../common/current-user.decorator";
import type { AuthenticatedUser } from "../auth/authenticated-request";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

import { UsersService } from "./users.service";

@Controller("users")
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @UseGuards(JwtAuthGuard)
  @Get("me")
  me(@CurrentUser() user: AuthenticatedUser): Promise<User> {
    return this.users.getById(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete("me")
  deleteMe(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    return this.users.deleteAccount(user.id);
  }
}
