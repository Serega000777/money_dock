import { createHmac, randomUUID } from "node:crypto";

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
    user: JSON.stringify({ id: userId, first_name: "TxE2E", language_code: "ru" }),
  });
  const dataCheckString = [...params.entries()]
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join("\n");
  const secretKey = createHmac("sha256", "WebAppData").update(BOT_TOKEN).digest();
  params.set("hash", createHmac("sha256", secretKey).update(dataCheckString).digest("hex"));
  return params.toString();
}

describe("Transactions (e2e)", () => {
  let app: INestApplication;
  let token: string;
  let cashAccountId: string;
  let cardAccountId: string;

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
    token = login.body.accessToken;

    const cash = await request(app.getHttpServer())
      .post("/accounts")
      .set("Authorization", `Bearer ${token}`)
      .send({ type: "cash", name: "Наличные", currency: "RUB", initialBalanceMinor: 10_000 })
      .expect(201);
    cashAccountId = cash.body.id;

    const card = await request(app.getHttpServer())
      .post("/accounts")
      .set("Authorization", `Bearer ${token}`)
      .send({ type: "card", name: "Карта", currency: "RUB", initialBalanceMinor: 5_000 })
      .expect(201);
    cardAccountId = card.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  const authed = (method: "get" | "post" | "patch" | "delete", path: string) =>
    request(app.getHttpServer())[method](path).set("Authorization", `Bearer ${token}`);

  it("an expense reduces the account balance", async () => {
    await request(app.getHttpServer())
      .post("/transactions")
      .set("Authorization", `Bearer ${token}`)
      .send({
        type: "expense",
        accountId: cashAccountId,
        amountMinor: 1_500,
        currency: "RUB",
        clientId: randomUUID(),
      })
      .expect(201);

    const res = await request(app.getHttpServer())
      .get(`/accounts/${cashAccountId}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(res.body.currentBalanceMinor).toBe(8_500);
  });

  it("an income increases the account balance", async () => {
    await request(app.getHttpServer())
      .post("/transactions")
      .set("Authorization", `Bearer ${token}`)
      .send({
        type: "income",
        accountId: cashAccountId,
        amountMinor: 2_000,
        currency: "RUB",
        clientId: randomUUID(),
      })
      .expect(201);

    const res = await request(app.getHttpServer())
      .get(`/accounts/${cashAccountId}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(res.body.currentBalanceMinor).toBe(10_500);
  });

  it("retrying a create with the same clientId does not duplicate the transaction", async () => {
    const clientId = randomUUID();
    const body = {
      type: "expense",
      accountId: cashAccountId,
      amountMinor: 100,
      currency: "RUB",
      clientId,
    };

    const first = await request(app.getHttpServer())
      .post("/transactions")
      .set("Authorization", `Bearer ${token}`)
      .send(body)
      .expect(201);
    const second = await request(app.getHttpServer())
      .post("/transactions")
      .set("Authorization", `Bearer ${token}`)
      .send(body)
      .expect(201);

    expect(second.body.id).toBe(first.body.id);

    const balance = await request(app.getHttpServer())
      .get(`/accounts/${cashAccountId}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(balance.body.currentBalanceMinor).toBe(10_400); // only debited once
  });

  it("rejects splits that don't sum to the transaction total", async () => {
    await request(app.getHttpServer())
      .post("/transactions")
      .set("Authorization", `Bearer ${token}`)
      .send({
        type: "expense",
        accountId: cashAccountId,
        amountMinor: 1_000,
        currency: "RUB",
        clientId: randomUUID(),
        splits: [{ categoryId: randomUUID(), amountMinor: 400 }],
      })
      .expect(400);
  });

  it("a transfer moves the balance from one account to the other without touching income/expense", async () => {
    const before = await authed("get", `/accounts/${cardAccountId}`).expect(200);

    await authed("post", "/transactions/transfer")
      .send({
        fromAccountId: cashAccountId,
        toAccountId: cardAccountId,
        amountMinor: 3_000,
        currency: "RUB",
        clientId: randomUUID(),
      })
      .expect(201);

    const cash = await authed("get", `/accounts/${cashAccountId}`).expect(200);
    const card = await authed("get", `/accounts/${cardAccountId}`).expect(200);
    expect(cash.body.currentBalanceMinor).toBe(10_400 - 3_000);
    expect(card.body.currentBalanceMinor).toBe(before.body.currentBalanceMinor + 3_000);
  });

  it("deleting one leg of a transfer removes both, restoring both balances", async () => {
    const cardBefore = await authed("get", `/accounts/${cardAccountId}`).expect(200);
    const cashBefore = await authed("get", `/accounts/${cashAccountId}`).expect(200);

    await authed("post", "/transactions/transfer")
      .send({
        fromAccountId: cashAccountId,
        toAccountId: cardAccountId,
        amountMinor: 500,
        currency: "RUB",
        clientId: randomUUID(),
      })
      .expect(201);

    const list = await authed("get", `/transactions?accountId=${cashAccountId}`).expect(200);
    const outgoingLeg = (
      list.body as Array<{ id: string; type: string; amountMinor: number }>
    ).find((t) => t.type === "transfer" && t.amountMinor === 500);
    expect(outgoingLeg).toBeDefined();

    await authed("delete", `/transactions/${outgoingLeg!.id}`).expect(200);

    const cardAfter = await authed("get", `/accounts/${cardAccountId}`).expect(200);
    const cashAfter = await authed("get", `/accounts/${cashAccountId}`).expect(200);
    expect(cardAfter.body.currentBalanceMinor).toBe(cardBefore.body.currentBalanceMinor);
    expect(cashAfter.body.currentBalanceMinor).toBe(cashBefore.body.currentBalanceMinor);
  });

  it("soft-deleting a transaction hides it from list/balance, and restore undoes both", async () => {
    const created = await authed("post", "/transactions")
      .send({
        type: "expense",
        accountId: cashAccountId,
        amountMinor: 777,
        currency: "RUB",
        clientId: randomUUID(),
      })
      .expect(201);
    const before = await authed("get", `/accounts/${cashAccountId}`).expect(200);

    await authed("delete", `/transactions/${created.body.id}`).expect(200);

    const afterDelete = await authed("get", `/accounts/${cashAccountId}`).expect(200);
    expect(afterDelete.body.currentBalanceMinor).toBe(before.body.currentBalanceMinor + 777);
    const list = await authed("get", `/transactions?accountId=${cashAccountId}`).expect(200);
    expect((list.body as Array<{ id: string }>).some((t) => t.id === created.body.id)).toBe(false);
    await authed("get", `/transactions/${created.body.id}`).expect(404);

    const restored = await authed("post", `/transactions/${created.body.id}/restore`).expect(201);
    expect(restored.body.id).toBe(created.body.id);
    const afterRestore = await authed("get", `/accounts/${cashAccountId}`).expect(200);
    expect(afterRestore.body.currentBalanceMinor).toBe(before.body.currentBalanceMinor);
  });

  it("refuses to restore a transaction that was never deleted", async () => {
    const created = await authed("post", "/transactions")
      .send({
        type: "expense",
        accountId: cashAccountId,
        amountMinor: 1,
        currency: "RUB",
        clientId: randomUUID(),
      })
      .expect(201);
    await authed("post", `/transactions/${created.body.id}/restore`).expect(404);
  });

  it("returns the {code, message, correlationId} error envelope on a 404", async () => {
    const res = await authed("get", `/transactions/${randomUUID()}`).expect(404);
    expect(res.body).toMatchObject({
      code: "NOT_FOUND",
      message: expect.any(String) as string,
      correlationId: expect.any(String) as string,
    });
    expect(res.headers["x-correlation-id"]).toBe(res.body.correlationId);
  });

  it("prevents one user from reading or editing another user's transaction (IDOR)", async () => {
    idCounter += 1;
    const otherLogin = await request(app.getHttpServer())
      .post("/auth/telegram")
      .send({ initData: signInitData(runPrefix * 1_000_000 + idCounter) })
      .expect(200);
    const otherToken = otherLogin.body.accessToken;

    const tx = await authed("post", "/transactions")
      .send({
        type: "expense",
        accountId: cashAccountId,
        amountMinor: 10,
        currency: "RUB",
        clientId: randomUUID(),
      })
      .expect(201);

    await request(app.getHttpServer())
      .get(`/transactions/${tx.body.id}`)
      .set("Authorization", `Bearer ${otherToken}`)
      .expect(404);
  });
});
