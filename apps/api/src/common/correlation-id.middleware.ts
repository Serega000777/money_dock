import { randomUUID } from "node:crypto";

import type { NextFunction, Request, Response } from "express";

export interface RequestWithCorrelation extends Request {
  correlationId: string;
}

/** Every request gets a correlation id — from the caller if it sent one, generated
 * otherwise — echoed back in the response header and in every error envelope (spec §28),
 * so a support ticket can be traced to a specific log line without exposing a stack trace. */
export function correlationIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header("x-correlation-id");
  const id = incoming && incoming.length > 0 && incoming.length <= 100 ? incoming : randomUUID();
  (req as RequestWithCorrelation).correlationId = id;
  res.setHeader("x-correlation-id", id);
  next();
}
