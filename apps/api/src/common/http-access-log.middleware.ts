import type { NextFunction, Request, Response } from "express";

import type { RequestWithCorrelation } from "./correlation-id.middleware";

/**
 * One structured JSON line per request (spec §32: "JSON structured logs с
 * correlation_id"). Deliberately `console.log(JSON.stringify(...))` rather than Nest's
 * `Logger` — that one pretty-prints for a human terminal, and an access log needs to
 * stay one-line-per-request machine-parseable JSON regardless of that setting.
 *
 * Only method/path/status/timing/correlationId/userId — never the body, query string,
 * or auth header, so a request carrying a token or a note's text never ends up in logs
 * (spec §11: "Никогда не логировать access tokens... чувствительные пользовательские
 * заметки").
 */
export function httpAccessLogMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Every e2e spec hits dozens of endpoints; one console.log per request would drown the
  // pass/fail summary in JSON noise without adding anything a failing assertion doesn't
  // already say. Still fully wired for dev/staging/production.
  if (process.env.NODE_ENV === "test") {
    next();
    return;
  }

  const startedAt = Date.now();

  res.on("finish", () => {
    console.log(
      JSON.stringify({
        type: "http_request",
        method: req.method,
        path: req.path,
        status: res.statusCode,
        durationMs: Date.now() - startedAt,
        correlationId: (req as RequestWithCorrelation).correlationId ?? null,
        userId: (req as Request & { user?: { id: string } }).user?.id ?? null,
      }),
    );
  });

  next();
}
