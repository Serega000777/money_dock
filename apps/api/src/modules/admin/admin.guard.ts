import { ForbiddenException, Injectable, type CanActivate, type ExecutionContext } from "@nestjs/common";

import type { AuthenticatedRequest } from "../auth/authenticated-request";
import { UsersService } from "../users/users.service";

/**
 * Always stacked after JwtAuthGuard (`@UseGuards(JwtAuthGuard, AdminGuard)`), never
 * alone — it trusts `request.user.id` to already be a verified user id, it just isn't
 * one itself. Checks the DB fresh on every request rather than trusting a JWT claim: the
 * access token is only good for 15 minutes, but "is this still an admin" should never lag
 * behind a real demotion even that long, and there's no demotion flow yet to make this
 * matter in practice — this is the seam for when there is.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly users: UsersService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = await this.users.getById(request.user.id);
    if (user.role !== "admin") throw new ForbiddenException("Admin access required");
    return true;
  }
}
