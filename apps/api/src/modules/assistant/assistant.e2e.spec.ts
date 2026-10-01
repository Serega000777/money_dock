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
    user: JSON.stringify({ id: userId, first_name: "AssistantE2E", language_code: "ru" }),
  });
  const data = [...params.entries()].map(([key, value]) => `${key}=${value}`).sort().join("\n");
  const secret = createHmac("sha256", "WebAppData").update(BOT_TOKEN).digest();
  params.set("hash", createHmac("sha256", secret).update(data).digest("hex"));
  return params.toString();
}

describe("Amola Assistant (e2e)", () => {
  let app: INestApplication;
  let token: string;

  async function newUser(): Promise<string> {
    idCounter += 1;
    const response = await request(app.getHttpServer())
      .post("/auth/telegram")
      .send({ initData: signInitData(runPrefix * 1_000_000 + idCounter) })
      .expect(200);
    return response.body.accessToken as string;
  }

  beforeAll(async () => {
    if (!BOT_TOKEN) throw new Error("TELEGRAM_BOT_TOKEN must be set");
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    token = await newUser();
    await request(app.getHttpServer())
      .post("/accounts")
      .set("Authorization", `Bearer ${token}`)
      .send({ type: "cash", name: "Наличные", currency: "RUB", initialBalanceMinor: 100_000 })
      .expect(201);
  });

  afterAll(async () => app.close());

  it("answers a read query with backend-calculated data", async () => {
    const conversation = await request(app.getHttpServer())
      .post("/assistant/conversations")
      .set("Authorization", `Bearer ${token}`)
      .send({})
      .expect(201);
    const response = await request(app.getHttpServer())
      .post(`/assistant/conversations/${conversation.body.id}/messages`)
      .set("Authorization", `Bearer ${token}`)
      .send({ text: "Покажи мой баланс", inputType: "text" })
      .expect(201);
    expect(response.body.message.content).toContain("1 000 ₽");
    expect(response.body.action).toBeNull();
  });

  it("creates a pending transaction action and confirms it exactly once", async () => {
    const conversation = await request(app.getHttpServer())
      .post("/assistant/conversations")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Тест операции" })
      .expect(201);
    const response = await request(app.getHttpServer())
      .post(`/assistant/conversations/${conversation.body.id}/messages`)
      .set("Authorization", `Bearer ${token}`)
      .send({ text: "Кофе 350", inputType: "text" })
      .expect(201);
    expect(response.body.action).toMatchObject({ tool: "create_transaction", status: "pending" });
    const actionId = response.body.action.id as string;

    await request(app.getHttpServer())
      .post(`/assistant/actions/${actionId}/confirm`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    await request(app.getHttpServer())
      .post(`/assistant/actions/${actionId}/confirm`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    const transactions = await request(app.getHttpServer())
      .get("/transactions")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(transactions.body.filter((row: { amountMinor: number }) => row.amountMinor === 35_000)).toHaveLength(1);
  });

  it("returns 404 for another user's conversation and action", async () => {
    const conversation = await request(app.getHttpServer())
      .post("/assistant/conversations")
      .set("Authorization", `Bearer ${token}`)
      .send({})
      .expect(201);
    const response = await request(app.getHttpServer())
      .post(`/assistant/conversations/${conversation.body.id}/messages`)
      .set("Authorization", `Bearer ${token}`)
      .send({ text: "Такси 900" })
      .expect(201);
    const foreignToken = await newUser();
    await request(app.getHttpServer())
      .get(`/assistant/conversations/${conversation.body.id}`)
      .set("Authorization", `Bearer ${foreignToken}`)
      .expect(404);
    await request(app.getHttpServer())
      .post(`/assistant/actions/${response.body.action.id}/confirm`)
      .set("Authorization", `Bearer ${foreignToken}`)
      .expect(404);
  });

  it("edits a pending draft before confirmation and can later update and delete it", async () => {
    const conversation = await request(app.getHttpServer()).post("/assistant/conversations").set("Authorization", `Bearer ${token}`).send({}).expect(201);
    const draft = await request(app.getHttpServer()).post(`/assistant/conversations/${conversation.body.id}/messages`).set("Authorization", `Bearer ${token}`).send({ text: "Кофе 410" }).expect(201);
    const edited = await request(app.getHttpServer()).patch(`/assistant/actions/${draft.body.action.id}`).set("Authorization", `Bearer ${token}`).send({ amountMinor: 42_000, type: "expense" }).expect(200);
    expect(edited.body.preview.amountMinor).toBe(42_000);
    await request(app.getHttpServer()).post(`/assistant/actions/${draft.body.action.id}/confirm`).set("Authorization", `Bearer ${token}`).expect(200);

    const update = await request(app.getHttpServer()).post(`/assistant/conversations/${conversation.body.id}/messages`).set("Authorization", `Bearer ${token}`).send({ text: "Поменяй последнюю трату на 1700" }).expect(201);
    expect(update.body.action.tool).toBe("update_transaction");
    await request(app.getHttpServer()).post(`/assistant/actions/${update.body.action.id}/confirm`).set("Authorization", `Bearer ${token}`).expect(200);

    const remove = await request(app.getHttpServer()).post(`/assistant/conversations/${conversation.body.id}/messages`).set("Authorization", `Bearer ${token}`).send({ text: "Удали последнюю покупку" }).expect(201);
    expect(remove.body.action.tool).toBe("delete_transaction");
    await request(app.getHttpServer()).post(`/assistant/actions/${remove.body.action.id}/confirm`).set("Authorization", `Bearer ${token}`).expect(200);
  });

  it("creates multi-transaction and recurring drafts and supports goal reads", async () => {
    const conversation = await request(app.getHttpServer()).post("/assistant/conversations").set("Authorization", `Bearer ${token}`).send({}).expect(201);
    const multi = await request(app.getHttpServer()).post(`/assistant/conversations/${conversation.body.id}/messages`).set("Authorization", `Bearer ${token}`).send({ text: "Сегодня кофе 300 и бензин 4000" }).expect(201);
    expect(multi.body.action.tool).toBe("create_multiple_transactions");
    const recurring = await request(app.getHttpServer()).post(`/assistant/conversations/${conversation.body.id}/messages`).set("Authorization", `Bearer ${token}`).send({ text: "Добавь аренду 45000 первого числа" }).expect(201);
    expect(recurring.body.action.tool).toBe("create_recurring_payment");
    const goals = await request(app.getHttpServer()).post(`/assistant/conversations/${conversation.body.id}/messages`).set("Authorization", `Bearer ${token}`).send({ text: "Как идут мои цели?" }).expect(201);
    expect(goals.body.message.content).toContain("Цел");
  // Three sequential LLM-dependent turns against a real provider when local keys are
  // configured (nothing here is mocked) — Jest's 5s default is too tight for that.
  }, 30_000);

  it("answers a month-scoped income question as income, not a repeat of the prior expense answer", async () => {
    const monthToken = await newUser();
    const account = await request(app.getHttpServer())
      .post("/accounts")
      .set("Authorization", `Bearer ${monthToken}`)
      .send({ type: "cash", name: "Наличные", currency: "RUB", initialBalanceMinor: 0 })
      .expect(201);
    const monthLabel = new Date().toLocaleDateString("ru-RU", { month: "long" });
    await request(app.getHttpServer())
      .post("/transactions")
      .set("Authorization", `Bearer ${monthToken}`)
      .send({ type: "expense", accountId: account.body.id, amountMinor: 50_000, currency: "RUB", clientId: randomUUID() })
      .expect(201);
    await request(app.getHttpServer())
      .post("/transactions")
      .set("Authorization", `Bearer ${monthToken}`)
      .send({ type: "income", accountId: account.body.id, amountMinor: 5_000_000, currency: "RUB", clientId: randomUUID() })
      .expect(201);

    const conversation = await request(app.getHttpServer()).post("/assistant/conversations").set("Authorization", `Bearer ${monthToken}`).send({}).expect(201);
    const expenseAnswer = await request(app.getHttpServer())
      .post(`/assistant/conversations/${conversation.body.id}/messages`)
      .set("Authorization", `Bearer ${monthToken}`)
      .send({ text: `Сколько я потратил в ${monthLabel}?` })
      .expect(201);
    expect(expenseAnswer.body.message.content).toContain("Расходы");
    expect(expenseAnswer.body.message.content).toMatch(/500\s*₽/);

    const incomeAnswer = await request(app.getHttpServer())
      .post(`/assistant/conversations/${conversation.body.id}/messages`)
      .set("Authorization", `Bearer ${monthToken}`)
      .send({ text: `А сколько денег я получил в ${monthLabel}?` })
      .expect(201);
    expect(incomeAnswer.body.message.content).toContain("Доход");
    expect(incomeAnswer.body.message.content).toMatch(/50\s*000\s*₽/);
  });
});
