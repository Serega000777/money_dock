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
    user: JSON.stringify({ id: userId, first_name: "DebtE2E", language_code: "ru" }),
  });
  const dataCheckString = [...params.entries()]
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join("\n");
  const secretKey = createHmac("sha256", "WebAppData").update(BOT_TOKEN).digest();
  params.set("hash", createHmac("sha256", secretKey).update(dataCheckString).digest("hex"));
  return params.toString();
}

describe("Debts (e2e)", () => {
  let app: INestApplication;
  let token: string;
  let otherToken: string;

  const authed = (method: "get" | "post" | "patch" | "delete", path: string, useToken = token) =>
    request(app.getHttpServer())[method](path).set("Authorization", `Bearer ${useToken}`);

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

    const other = await request(app.getHttpServer())
      .post("/auth/telegram")
      .send({ initData: signInitData(runPrefix * 1_000_000 + 2) })
      .expect(200);
    otherToken = other.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it("refuses an unauthenticated caller", async () => {
    await request(app.getHttpServer()).get("/debts").expect(401);
  });

  it("creates a debt in each direction and lists both", async () => {
    await authed("post", "/debts")
      .send({ direction: "owed_to_me", counterpartyName: "Саша", amountMinor: 300_000, currency: "RUB" })
      .expect(201);
    await authed("post", "/debts")
      .send({ direction: "i_owe", counterpartyName: "Маша", amountMinor: 150_000, currency: "RUB" })
      .expect(201);

    const list = await authed("get", "/debts").expect(200);
    expect(list.body).toHaveLength(2);
    expect(list.body.map((d: { direction: string }) => d.direction).sort()).toEqual([
      "i_owe",
      "owed_to_me",
    ]);
    expect(list.body.every((d: { settledAt: unknown }) => d.settledAt === null)).toBe(true);
  });

  it("defaults currency to RUB when omitted", async () => {
    const res = await authed("post", "/debts")
      .send({ direction: "owed_to_me", counterpartyName: "Петя", amountMinor: 1000 })
      .expect(201);
    expect(res.body.currency).toBe("RUB");
  });

  it("updates a debt's fields", async () => {
    const created = await authed("post", "/debts")
      .send({ direction: "i_owe", counterpartyName: "Коля", amountMinor: 5000, currency: "RUB" })
      .expect(201);

    const updated = await authed("patch", `/debts/${created.body.id}`)
      .send({ amountMinor: 7500, note: "за обед" })
      .expect(200);
    expect(updated.body.amountMinor).toBe(7500);
    expect(updated.body.note).toBe("за обед");
    expect(updated.body.counterpartyName).toBe("Коля");
  });

  it("settles and unsettles a debt", async () => {
    const created = await authed("post", "/debts")
      .send({ direction: "owed_to_me", counterpartyName: "Дима", amountMinor: 2000, currency: "RUB" })
      .expect(201);

    const settled = await authed("post", `/debts/${created.body.id}/settle`).expect(201);
    expect(settled.body.settledAt).not.toBeNull();

    const reopened = await authed("post", `/debts/${created.body.id}/unsettle`).expect(201);
    expect(reopened.body.settledAt).toBeNull();
  });

  it("deletes a debt", async () => {
    const created = await authed("post", "/debts")
      .send({ direction: "i_owe", counterpartyName: "Убрать", amountMinor: 100, currency: "RUB" })
      .expect(201);

    await authed("delete", `/debts/${created.body.id}`).expect(204);

    const list = await authed("get", "/debts").expect(200);
    expect(list.body.find((d: { id: string }) => d.id === created.body.id)).toBeUndefined();
  });

  it("keeps each user's debts private — no cross-account read, update, or delete", async () => {
    const created = await authed("post", "/debts")
      .send({ direction: "owed_to_me", counterpartyName: "Приватно", amountMinor: 100, currency: "RUB" })
      .expect(201);

    const otherList = await authed("get", "/debts", otherToken).expect(200);
    expect(otherList.body.find((d: { id: string }) => d.id === created.body.id)).toBeUndefined();

    await authed("patch", `/debts/${created.body.id}`, otherToken)
      .send({ amountMinor: 999 })
      .expect(404);
    await authed("post", `/debts/${created.body.id}/settle`, otherToken).expect(404);
    await authed("delete", `/debts/${created.body.id}`, otherToken).expect(404);
  });

  it("rejects an invalid direction instead of silently coercing it", async () => {
    await authed("post", "/debts")
      .send({ direction: "sideways", counterpartyName: "Кто-то", amountMinor: 100, currency: "RUB" })
      .expect(400);
  });
});
