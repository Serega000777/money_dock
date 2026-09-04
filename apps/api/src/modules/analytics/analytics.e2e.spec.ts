import { createHmac, randomUUID } from "node:crypto";

import {
  averageDailySpend,
  daysRemainingInMonth,
  dayOfMonth,
  monthEndForecast,
  safeToSpendPerDay,
} from "@money-dock/business-rules";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";

import { AppModule } from "../../app.module";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "";
const runPrefix = Math.floor(Math.random() * 1_000_000);

function signInitData(userId: number): string {
  const params = new URLSearchParams({
    auth_date: String(Math.floor(Date.now() / 1000)),
    user: JSON.stringify({ id: userId, first_name: "AnalyticsE2E", language_code: "ru" }),
  });
  const dataCheckString = [...params.entries()]
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join("\n");
  const secretKey = createHmac("sha256", "WebAppData").update(BOT_TOKEN).digest();
  params.set("hash", createHmac("sha256", secretKey).update(dataCheckString).digest("hex"));
  return params.toString();
}

describe("Analytics (e2e)", () => {
  let app: INestApplication;
  let token: string;
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

    // Default new-user timezone is Europe/Moscow (see UsersService).
    const account = await request(app.getHttpServer())
      .post("/accounts")
      .set("Authorization", `Bearer ${token}`)
      .send({ type: "cash", name: "Наличные", currency: "RUB", initialBalanceMinor: 100_000 })
      .expect(201);
    accountId = account.body.id;

    await request(app.getHttpServer())
      .post("/transactions")
      .set("Authorization", `Bearer ${token}`)
      .send({
        type: "expense",
        accountId,
        amountMinor: 5_000,
        currency: "RUB",
        clientId: randomUUID(),
      })
      .expect(201);
    await request(app.getHttpServer())
      .post("/transactions")
      .set("Authorization", `Bearer ${token}`)
      .send({
        type: "income",
        accountId,
        amountMinor: 2_000,
        currency: "RUB",
        clientId: randomUUID(),
      })
      .expect(201);
  });

  afterAll(async () => {
    await app.close();
  });

  it("computes balance, safe-to-spend, and today's expense from real data using the deterministic formulas", async () => {
    const res = await request(app.getHttpServer())
      .get("/analytics/summary")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    const now = new Date();
    const tz = "Europe/Moscow";
    const expectedBalance = 100_000 - 5_000 + 2_000;
    const daysRemaining = daysRemainingInMonth(now, tz);
    const elapsedDays = dayOfMonth(now, tz);
    const expectedAvgDaily = averageDailySpend(5_000, elapsedDays);

    expect(res.body.totalBalanceMinor).toBe(expectedBalance);
    expect(res.body.currentMonthExpenseMinor).toBe(5_000);
    expect(res.body.currentMonthIncomeMinor).toBe(2_000);
    expect(res.body.todayExpenseMinor).toBe(5_000);
    expect(res.body.daysRemainingInMonth).toBe(daysRemaining);
    expect(res.body.safeToSpendPerDayMinor).toBe(
      Math.round(safeToSpendPerDay(expectedBalance, daysRemaining)),
    );
    expect(res.body.monthEndForecastMinor).toBe(
      Math.round(monthEndForecast(expectedBalance, expectedAvgDaily, daysRemaining)),
    );
  });

  it("never leaks another user's transactions into the summary", async () => {
    const otherLogin = await request(app.getHttpServer())
      .post("/auth/telegram")
      .send({ initData: signInitData(runPrefix * 1_000_000 + 2) })
      .expect(200);

    const res = await request(app.getHttpServer())
      .get("/analytics/summary")
      .set("Authorization", `Bearer ${otherLogin.body.accessToken}`)
      .expect(200);

    expect(res.body.totalBalanceMinor).toBe(0);
    expect(res.body.currentMonthExpenseMinor).toBe(0);
  });
});
