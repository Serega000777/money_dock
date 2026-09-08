import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import type { Response } from "express";

import type { RequestWithCorrelation } from "./correlation-id.middleware";

const STATUS_CODES: Partial<Record<number, string>> = {
  [HttpStatus.BAD_REQUEST]: "BAD_REQUEST",
  [HttpStatus.UNAUTHORIZED]: "UNAUTHORIZED",
  [HttpStatus.FORBIDDEN]: "FORBIDDEN",
  [HttpStatus.NOT_FOUND]: "NOT_FOUND",
  [HttpStatus.CONFLICT]: "CONFLICT",
  [HttpStatus.UNPROCESSABLE_ENTITY]: "UNPROCESSABLE_ENTITY",
  [HttpStatus.TOO_MANY_REQUESTS]: "TOO_MANY_REQUESTS",
};

/**
 * Single error shape for the whole API (spec §28): `{code, message, correlationId,
 * details?}`. `details` only ever carries what the exception itself already exposed
 * (e.g. Zod's `.flatten()` field errors) — an unexpected (non-HttpException) failure
 * gets a generic message and its real stack goes to the server log, tagged with the same
 * correlationId, never to the client.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger("ExceptionFilter");

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<RequestWithCorrelation>();
    const correlationId = request.correlationId ?? request.header("x-correlation-id") ?? "unknown";

    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const code = STATUS_CODES[status] ?? "INTERNAL_ERROR";

    let message = "Internal server error";
    let details: unknown;

    if (exception instanceof HttpException) {
      const body = exception.getResponse();
      if (typeof body === "string") {
        message = body;
      } else if (body && typeof body === "object") {
        const { message: bodyMessage, statusCode: _statusCode, error: _error, ...rest } = body as {
          message?: unknown;
          statusCode?: unknown;
          error?: unknown;
          [key: string]: unknown;
        };
        message = typeof bodyMessage === "string" ? bodyMessage : exception.message;
        if (Object.keys(rest).length > 0) details = rest;
      } else {
        message = exception.message;
      }
    } else {
      const stack = exception instanceof Error ? exception.stack : String(exception);
      this.logger.error(`Unhandled exception [${correlationId}]: ${stack}`);
    }

    response.status(status).json({ code, message, correlationId, ...(details ? { details } : {}) });
  }
}
