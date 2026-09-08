import { createHmac, randomUUID } from "node:crypto";

import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";

import { AppModule } from "../../app.module";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "";
const runPrefix = Math.floor(Math.random() * 1_000_000);

function signInitData(userId: number): string {
  const params = new URLSearchParams({
    auth_date: String(Math.floor(Date.now() / 1000)),
    user: JSON.stringify({ id: userId, first_name: "ExportE2E", language_code: "ru" }),
  });
  const dataCheckString = [...params.entries()]
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join("\n");
  const secretKey = createHmac("sha256", "WebAppData").update(BOT_TOKEN).digest();
  params.set("hash", createHmac("sha256", secretKey).update(dataCheckString).digest("hex"));
  return params.toString();
}

describe("Export (e2e)", () => {
  let app: INestApplication;
  let token: string;
  let userId: string;
  let accountId: string;

  beforeAll(async () => {
    if (!BOT_TOKEN) throw new Error("TELEGRAM_BOT_TOKEN must be set to run this suite");
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();

    const login = await request(app.getHttpServer())
      .post("/auth/telegram")
      .send({ initData: signInitData(runPrefix * 1_000_000 + 1) })
      .expect(200);
    token = login.body.accessToken;
    userId = login.body.user.id;

    const account = await request(app.getHttpServer())
      .post("/accounts")
      .set("Authorization", `Bearer ${token}`)
      .send({ type: "cash", name: "Наличные", currency: "RUB", initialBalanceMinor: 1_000 })
      .expect(201);
    accountId = account.body.id;

    await request(app.getHttpServer())
      .post("/transactions")
      .set("Authorization", `Bearer ${token}`)
      .send({
        type: "expense",
        accountId,
        amountMinor: 250,
        currency: "RUB",
        merchant: "Кафе",
        clientId: randomUUID(),
      })
      .expect(201);

    await request(app.getHttpServer())
      .post("/notes")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Отложить на отпуск" })
      .expect(201);
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns everything the user has entered", async () => {
    const res = await request(app.getHttpServer())
      .post("/exports")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(res.body.user.id).toBe(userId);
    expect(res.body.accounts).toHaveLength(1);
    expect(res.body.accounts[0].id).toBe(accountId);
    expect(res.body.transactions).toHaveLength(1);
    expect(res.body.transactions[0]).toMatchObject({ amountMinor: 250, merchant: "Кафе" });
    expect(res.body.notes).toHaveLength(1);
    expect(res.body.notes[0].title).toBe("Отложить на отпуск");
    expect(typeof res.body.exportedAt).toBe("string");
  });

  it("requires authentication", async () => {
    await request(app.getHttpServer()).post("/exports").expect(401);
  });
});
