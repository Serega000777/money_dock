import { Injectable, type CallHandler, type ExecutionContext, type NestInterceptor } from "@nestjs/common";
import type { Observable } from "rxjs";

import type { AuthenticatedRequest } from "../modules/auth/authenticated-request";
import { UsersService } from "../modules/users/users.service";

/**
 * A global `APP_INTERCEPTOR` (see AppModule), not a dependency of JwtAuthGuard itself —
 * see the comment there for why. Interceptors run after every guard on the request has
 * already resolved, so `request.user` is set on any route JwtAuthGuard protected, and
 * simply absent (skipped here) on public ones like /health or /auth/telegram.
 */
@Injectable()
export class LastActiveInterceptor implements NestInterceptor {
  constructor(private readonly users: UsersService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const userId = request.user?.id;
    if (userId) {
      // Fire-and-forget: powers the admin panel's active-user counts, nothing in the
      // request path depends on it, so a failure here must never fail the request.
      this.users.touchLastActive(userId).catch(() => {});
    }
    return next.handle();
  }
}
