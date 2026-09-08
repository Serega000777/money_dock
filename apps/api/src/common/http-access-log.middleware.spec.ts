import type { Request, Response } from "express";

import type { RequestWithCorrelation } from "./correlation-id.middleware";
import { httpAccessLogMiddleware } from "./http-access-log.middleware";

function fakeReqRes(overrides: Partial<RequestWithCorrelation> = {}) {
  let finishHandler: (() => void) | undefined;
  const req = {
    method: "GET",
    path: "/accounts",
    correlationId: "corr-1",
    ...overrides,
  } as RequestWithCorrelation;
  const res = {
    statusCode: 200,
    on: (event: string, handler: () => void) => {
      if (event === "finish") finishHandler = handler;
    },
  } as unknown as Response;
  return { req: req as unknown as Request, res, finish: () => finishHandler?.() };
}

describe("httpAccessLogMiddleware", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    // The middleware no-ops under NODE_ENV=test (jest's default) to keep e2e output
    // readable — flip it to exercise the real logging path here.
    process.env.NODE_ENV = "development";
    logSpy = jest.spyOn(console, "log").mockImplementation(() => undefined);
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    logSpy.mockRestore();
  });

  it("logs a structured JSON line on response finish, without the body or auth header", () => {
    const { req, res, finish } = fakeReqRes({
      method: "POST",
      path: "/transactions",
      correlationId: "corr-42",
    });
    Object.assign(req as unknown as { user?: { id: string } }, { user: { id: "user-1" } });
    const next = jest.fn();

    httpAccessLogMiddleware(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);

    (res as unknown as { statusCode: number }).statusCode = 201;
    finish();

    expect(logSpy).toHaveBeenCalledTimes(1);
    const logged = JSON.parse(logSpy.mock.calls[0]![0] as string) as Record<string, unknown>;
    expect(logged).toMatchObject({
      type: "http_request",
      method: "POST",
      path: "/transactions",
      status: 201,
      correlationId: "corr-42",
      userId: "user-1",
    });
    expect(typeof logged.durationMs).toBe("number");
    expect(Object.keys(logged).sort()).toEqual(
      ["correlationId", "durationMs", "method", "path", "status", "type", "userId"].sort(),
    );
  });

  it("logs null userId for an unauthenticated request", () => {
    const { req, res, finish } = fakeReqRes();
    httpAccessLogMiddleware(req, res, jest.fn());
    finish();

    const logged = JSON.parse(logSpy.mock.calls[0]![0] as string) as Record<string, unknown>;
    expect(logged.userId).toBeNull();
  });

  it("no-ops under NODE_ENV=test", () => {
    process.env.NODE_ENV = "test";
    const { req, res, finish } = fakeReqRes();
    const next = jest.fn();

    httpAccessLogMiddleware(req, res, next);
    finish();

    expect(next).toHaveBeenCalledTimes(1);
    expect(logSpy).not.toHaveBeenCalled();
  });
});
