import { createHmac } from "node:crypto";

import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";

import { AppModule } from "../../app.module";
import { EntitlementsService } from "../entitlements/entitlements.service";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "";
const runPrefix = Math.floor(Math.random() * 1_000_000);
let idCounter = 0;

function signInitData(userId: number): string {
  const params = new URLSearchParams({
    auth_date: String(Math.floor(Date.now() / 1000)),
    user: JSON.stringify({ id: userId, first_name: "CmdE2E", language_code: "ru" }),
  });
  const dataCheckString = [...params.entries()]
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join("\n");
  const secretKey = createHmac("sha256", "WebAppData").update(BOT_TOKEN).digest();
  params.set("hash", createHmac("sha256", secretKey).update(dataCheckString).digest("hex"));
  return params.toString();
}

describe("Voice/text commands + entitlements (e2e)", () => {
  let app: INestApplication;
  let entitlements: EntitlementsService;
  let token: string;
  let userId: string;

  const authed = (method: "get" | "post", path: string) =>
    request(app.getHttpServer())[method](path).set("Authorization", `Bearer ${token}`);

  async function newUser() {
    idCounter += 1;
    const res = await request(app.getHttpServer())
      .post("/auth/telegram")
      .send({ initData: signInitData(runPrefix * 1_000_000 + idCounter) })
      .expect(200);
    return res.body as { accessToken: string; user: { id: string } };
  }

  beforeAll(async () => {
    if (!BOT_TOKEN) throw new Error("TELEGRAM_BOT_TOKEN must be set to run this suite");
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    entitlements = app.get(EntitlementsService);

    const login = await newUser();
    token = login.accessToken;
    userId = login.user.id;

    await authed("post", "/accounts")
      .send({ type: "cash", name: "Наличные", currency: "RUB", initialBalanceMinor: 0 })
      .expect(201);
  });

  afterAll(async () => {
    await app.close();
  });

  it("turns a full spoken phrase into a draft with account and category resolved", async () => {
    const res = await authed("post", "/commands/parse")
      .send({ text: "Вчера потратил 840 рублей в кафе с наличных", source: "text" })
      .expect(200);

    expect(res.body).toMatchObject({ type: "expense", amountMinor: 84_000 });
    expect(res.body.categoryName).toBe("Кафе и рестораны");
    expect(res.body.accountName).toBe("Наличные");
    expect(res.body.confidence).toBeGreaterThan(0.85);
  });

  it("explains which parts it recognized, so the confirmation card can show why", async () => {
    const res = await authed("post", "/commands/parse")
      .send({ text: "потратил 2500 на бензин", source: "text" })
      .expect(200);
    expect(res.body.explanation).toEqual(
      expect.arrayContaining(["сумма", "тип операции", "категория"]),
    );
  });

  it("never creates a transaction — parsing only returns a draft", async () => {
    const before = await authed("get", "/transactions").expect(200);
    await authed("post", "/commands/parse")
      .send({ text: "потратил 500", source: "text" })
      .expect(200);
    const after = await authed("get", "/transactions").expect(200);
    expect(after.body.length).toBe(before.body.length);
  });

  it("rejects a phrase with no amount instead of guessing one", async () => {
    await authed("post", "/commands/parse")
      .send({ text: "купил что-то вкусное", source: "text" })
      .expect(400);
  });

  it("does not meter typed commands", async () => {
    const fresh = await newUser();
    for (let i = 0; i < 12; i++) {
      await request(app.getHttpServer())
        .post("/commands/parse")
        .set("Authorization", `Bearer ${fresh.accessToken}`)
        .send({ text: "потратил 100", source: "text" })
        .expect(200);
    }
    const state = await request(app.getHttpServer())
      .get("/entitlements")
      .set("Authorization", `Bearer ${fresh.accessToken}`)
      .expect(200);
    expect(state.body.used.voice).toBe(0);
  });

  it("meters voice on the free plan and blocks past the limit", async () => {
    const fresh = await newUser();
    const voice = (t: string) =>
      request(app.getHttpServer())
        .post("/commands/parse")
        .set("Authorization", `Bearer ${fresh.accessToken}`)
        .send({ text: t, source: "voice" });

    for (let i = 0; i < 10; i++) await voice("потратил 100").expect(200);

    const blocked = await voice("потратил 100").expect(403);
    expect(String(blocked.body.message)).toContain("Pro");
  });

  it("lifts the voice limit on Pro", async () => {
    const fresh = await newUser();
    await entitlements.setPlan(fresh.user.id, "pro");

    for (let i = 0; i < 12; i++) {
      await request(app.getHttpServer())
        .post("/commands/parse")
        .set("Authorization", `Bearer ${fresh.accessToken}`)
        .send({ text: "потратил 100", source: "voice" })
        .expect(200);
    }
  });

  it("treats an expired paid plan as free", async () => {
    const fresh = await newUser();
    await entitlements.setPlan(fresh.user.id, "pro", new Date(Date.now() - 86_400_000));

    const state = await request(app.getHttpServer())
      .get("/entitlements")
      .set("Authorization", `Bearer ${fresh.accessToken}`)
      .expect(200);
    expect(state.body.plan).toBe("free");
  });

  it("reports the current plan and usage", async () => {
    const res = await authed("get", "/entitlements").expect(200);
    expect(res.body.plan).toBe("free");
    expect(res.body.limits.voice).toBe(10);
    expect(typeof res.body.used.voice).toBe("number");
    expect(userId).toBeTruthy();
  });
});
