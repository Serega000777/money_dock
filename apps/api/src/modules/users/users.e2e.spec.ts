import { createHmac } from "node:crypto";

import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";

import { AppModule } from "../../app.module";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "";
const runPrefix = Math.floor(Math.random() * 1_000_000);

function signInitData(userId: number): string {
  const params = new URLSearchParams({
    auth_date: String(Math.floor(Date.now() / 1000)),
    user: JSON.stringify({ id: userId, first_name: "DeleteMeE2E", language_code: "ru" }),
  });
  const dataCheckString = [...params.entries()]
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join("\n");
  const secretKey = createHmac("sha256", "WebAppData").update(BOT_TOKEN).digest();
  params.set("hash", createHmac("sha256", secretKey).update(dataCheckString).digest("hex"));
  return params.toString();
}

describe("Account deletion (e2e)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    if (!BOT_TOKEN) throw new Error("TELEGRAM_BOT_TOKEN must be set to run this suite");
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("removes the account and cascades its owned data", async () => {
    const login = await request(app.getHttpServer())
      .post("/auth/telegram")
      .send({ initData: signInitData(runPrefix * 1_000_000 + 1) })
      .expect(200);
    const token = login.body.accessToken as string;

    await request(app.getHttpServer())
      .post("/accounts")
      .set("Authorization", `Bearer ${token}`)
      .send({ type: "cash", name: "Наличные", currency: "RUB", initialBalanceMinor: 0 })
      .expect(201);

    await request(app.getHttpServer())
      .delete("/users/me")
      .set("Authorization", `Bearer ${token}`)
      .expect(204);

    // The access token is still cryptographically valid (15 min TTL) but the row is gone.
    await request(app.getHttpServer())
      .get("/users/me")
      .set("Authorization", `Bearer ${token}`)
      .expect(404);

    const accounts = await request(app.getHttpServer())
      .get("/accounts")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(accounts.body).toEqual([]);
  });

  it("requires authentication", async () => {
    await request(app.getHttpServer()).delete("/users/me").expect(401);
  });
});
