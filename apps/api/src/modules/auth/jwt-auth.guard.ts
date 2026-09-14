import {
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";

import type { AuthenticatedRequest } from "./authenticated-request";
import type { AccessTokenPayload } from "./token.types";

/**
 * Deliberately depends on nothing but JwtService. Every protected controller in the app
 * references this class directly via `@UseGuards(JwtAuthGuard)`, which makes Nest resolve
 * its constructor from *each consuming module's* own DI context, not just AuthModule's —
 * even though AuthModule is `@Global()`. Giving it a dependency (UsersService, to touch
 * last-active) broke every module that doesn't happen to import UsersModule itself
 * (AccountsModule, first to surface it). See LastActiveInterceptor for where that side
 * effect actually lives instead: a global `APP_INTERCEPTOR`, constructed once in
 * AppModule's own context, which already imports UsersModule.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = extractBearerToken(request.headers.authorization);
    if (!token) throw new UnauthorizedException("Missing bearer token");

    try {
      const payload = await this.jwt.verifyAsync<AccessTokenPayload>(token);
      request.user = { id: payload.sub };
      return true;
    } catch {
      throw new UnauthorizedException("Invalid or expired token");
    }
  }
}

function extractBearerToken(header: string | undefined): string | null {
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length).trim() || null;
}
