import { createHmac } from "node:crypto";

import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";

import { AppModule } from "../../app.module";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "";
const runPrefix = Math.floor(Math.random() * 1_000_000);
let idCounter = 0;

function signInitData(userId: number): string {
  const params = new URLSearchParams({
    auth_date: String(Math.floor(Date.now() / 1000)),
    user: JSON.stringify({ id: userId, first_name: "ShortcutE2E", language_code: "ru" }),
  });
  const dataCheckString = [...params.entries()]
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join("\n");
  const secretKey = createHmac("sha256", "WebAppData").update(BOT_TOKEN).digest();
  params.set("hash", createHmac("sha256", secretKey).update(dataCheckString).digest("hex"));
  return params.toString();
}

describe("Shortcut capture (e2e)", () => {
  let app: INestApplication;
  let accessToken: string;

  beforeAll(async () => {
    if (!BOT_TOKEN) throw new Error("TELEGRAM_BOT_TOKEN must be set to run this suite");
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();

    idCounter += 1;
    const login = await request(app.getHttpServer())
      .post("/auth/telegram")
      .send({ initData: signInitData(runPrefix * 1_000_000 + idCounter) })
      .expect(200);
    accessToken = login.body.accessToken;

    // Any account works as the capture target — commands.capture falls back to the
    // parser's own account-hint resolution when none is given, but that path needs at
    // least one account to exist for this user first.
    await request(app.getHttpServer())
      .post("/accounts")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ type: "cash", name: "Наличные", currency: "RUB" })
      .expect(201);
  });

  afterAll(async () => {
    await app.close();
  });

  it("captures a transaction with a client-supplied UUID, keyed by Bearer token", async () => {
    const created = await request(app.getHttpServer())
      .post("/shortcut-credentials")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "Test iPhone" })
      .expect(201);
    const token = created.body.token as string;
    expect(token).toMatch(/^amola_sk_/);

    const capture = await request(app.getHttpServer())
      .post("/shortcut/transactions")
      .set("Authorization", `Bearer ${token}`)
      .send({
        input: "Кофе 340 рублей",
        mode: "text",
        source: "ios_shortcut",
        clientRequestId: "11111111-1111-4111-8111-111111111111",
      })
      .expect(201);
    expect(capture.body.success).toBe(true);
    expect(capture.body.transaction.amountMinor).toBe(34_000);
  });

  it("captures without a clientRequestId — the server fills one in instead of rejecting the call", async () => {
    const created = await request(app.getHttpServer())
      .post("/shortcut-credentials")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "Test Android" })
      .expect(201);
    const token = created.body.token as string;

    // No clientRequestId, and "source" is an arbitrary label an Android HTTP-shortcut
    // app might send — the schema no longer restricts it to the literal "ios_shortcut".
    const capture = await request(app.getHttpServer())
      .post("/shortcut/transactions")
      .set("Authorization", `Bearer ${token}`)
      .send({ input: "Такси 250 рублей", mode: "text", source: "android_http_shortcuts" })
      .expect(201);
    expect(capture.body.success).toBe(true);
    expect(capture.body.transaction.amountMinor).toBe(25_000);

    // A second call with the same input still creates its own transaction — omitting
    // clientRequestId must never make every request after the first look like a retry.
    const second = await request(app.getHttpServer())
      .post("/shortcut/transactions")
      .set("Authorization", `Bearer ${token}`)
      .send({ input: "Такси 250 рублей", mode: "text" })
      .expect(201);
    expect(second.body.transaction.id).not.toBe(capture.body.transaction.id);
  });

  it("rejects a missing or revoked token", async () => {
    await request(app.getHttpServer())
      .post("/shortcut/transactions")
      .send({ input: "Кофе 100 рублей", clientRequestId: "22222222-2222-4222-8222-222222222222" })
      .expect(401);

    const created = await request(app.getHttpServer())
      .post("/shortcut-credentials")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "To revoke" })
      .expect(201);
    const token = created.body.token as string;

    await request(app.getHttpServer())
      .delete(`/shortcut-credentials/${created.body.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .post("/shortcut/transactions")
      .set("Authorization", `Bearer ${token}`)
      .send({ input: "Кофе 100 рублей", clientRequestId: "33333333-3333-4333-8333-333333333333" })
      .expect(401);
  });
});
