import { Test } from "@nestjs/testing";

import { DATABASE } from "../../db/database.token";

import { HealthController } from "./health.controller";

describe("HealthController", () => {
  async function build(execute: () => Promise<unknown>) {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: DATABASE, useValue: { execute } }],
    }).compile();

    return moduleRef.get(HealthController);
  }

  it("reports ok when the database responds", async () => {
    const controller = await build(() => Promise.resolve());
    await expect(controller.check()).resolves.toEqual({ status: "ok", db: "ok" });
  });

  it("reports degraded when the database throws", async () => {
    const controller = await build(() => Promise.reject(new Error("connection refused")));
    await expect(controller.check()).resolves.toEqual({ status: "degraded", db: "error" });
  });
});
