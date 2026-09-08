import { createHmac, randomUUID } from "node:crypto";

import { addDays, startOfDay } from "@money-dock/business-rules";
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
    user: JSON.stringify({ id: userId, first_name: "InsightsE2E", language_code: "ru" }),
  });
  const dataCheckString = [...params.entries()]
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join("\n");
  const secretKey = createHmac("sha256", "WebAppData").update(BOT_TOKEN).digest();
  params.set("hash", createHmac("sha256", secretKey).update(dataCheckString).digest("hex"));
  return params.toString();
}

/**
 * Noon, Moscow time, N days before the *Moscow* calendar day containing right now —
 * comfortably inside "N days ago" the way InsightsService means it (users default to
 * Europe/Moscow). Anchoring in UTC instead, like a plain `setUTCDate` would, is wrong
 * for ~3 hours of every UTC day: 21:00-24:00 UTC is already past midnight in Moscow, so
 * "yesterday" by UTC's calendar and by Moscow's calendar are off by one during that
 * window — exactly the case that turned this fixture flaky.
 */
function daysAgoNoon(days: number): string {
  const todayMoscow = startOfDay(new Date(), "Europe/Moscow");
  const target = addDays(todayMoscow, -days);
  return new Date(target.getTime() + 12 * 3_600_000).toISOString();
}

describe("Insights (e2e)", () => {
  let app: INestApplication;
  let token: string;
  let accountId: string;
  let restaurantsCategoryId: string;

  const authed = (method: "get" | "post", path: string) =>
    request(app.getHttpServer())[method](path).set("Authorization", `Bearer ${token}`);

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

    const account = await authed("post", "/accounts")
      .send({ type: "cash", name: "Наличные", currency: "RUB", initialBalanceMinor: 1_000_000 })
      .expect(201);
    accountId = account.body.id;

    const categoriesRes = await authed("get", "/categories").expect(200);
    restaurantsCategoryId = (
      categoriesRes.body as Array<{ id: string; systemCode: string | null }>
    ).find((c) => c.systemCode === "restaurants")!.id;

    // Yesterday's spend, for the daily summary.
    await authed("post", "/transactions")
      .send({
        type: "expense",
        accountId,
        amountMinor: 468_00,
        currency: "RUB",
        occurredAt: daysAgoNoon(1),
        clientId: randomUUID(),
      })
      .expect(201);

    // Previous 30-60 day window: 2 000 ₽ on restaurants.
    await authed("post", "/transactions")
      .send({
        type: "expense",
        accountId,
        categoryId: restaurantsCategoryId,
        amountMinor: 200_000,
        currency: "RUB",
        occurredAt: daysAgoNoon(45),
        clientId: randomUUID(),
      })
      .expect(201);

    // Current 0-30 day window: 4 000 ₽ on restaurants — a 100% jump, well past both
    // thresholds (spec example: "доставка еды выросла на 4 800 ₽ за 30 дней").
    await authed("post", "/transactions")
      .send({
        type: "expense",
        accountId,
        categoryId: restaurantsCategoryId,
        amountMinor: 400_000,
        currency: "RUB",
        occurredAt: daysAgoNoon(10),
        clientId: randomUUID(),
      })
      .expect(201);
  });

  afterAll(async () => {
    await app.close();
  });

  it("computes the daily summary from real transactions and review count", async () => {
    const res = await authed("get", "/insights/daily-summary").expect(200);

    expect(res.body.yesterdayExpenseMinor).toBe(46_800);
    expect(typeof res.body.safeToSpendPerDayMinor).toBe("number");
    expect(typeof res.body.reviewCount).toBe("number");
  });

  it("surfaces a category-growth insight for the merchant category that grew", async () => {
    const res = await authed("get", "/insights").expect(200);

    const items = res.body as Array<{
      id: string;
      code: string;
      severity: string;
      facts: { categoryId: string; growthPercent: number; currentMinor: number };
      readAt: string | null;
    }>;
    const growth = items.find((i) => i.facts.categoryId === restaurantsCategoryId);

    expect(growth).toBeDefined();
    expect(growth?.code).toBe("category_growth");
    expect(growth?.severity).toBe("warning"); // 100% growth clears the 50% warning bar
    expect(growth?.facts.currentMinor).toBe(400_000);
    expect(growth?.facts.growthPercent).toBeGreaterThanOrEqual(20);
    expect(growth?.readAt).toBeNull();
  });

  it("marks an insight read", async () => {
    const list = await authed("get", "/insights").expect(200);
    const insightId = (list.body as Array<{ id: string }>)[0]!.id;

    await authed("post", `/insights/${insightId}/read`).expect(204);

    const after = await authed("get", "/insights").expect(200);
    const updated = (after.body as Array<{ id: string; readAt: string | null }>).find(
      (i) => i.id === insightId,
    );
    expect(updated?.readAt).not.toBeNull();
  });

  it("prevents one user from marking another user's insight read (IDOR)", async () => {
    const list = await authed("get", "/insights").expect(200);
    const insightId = (list.body as Array<{ id: string }>)[0]!.id;

    idCounter += 1;
    const other = await request(app.getHttpServer())
      .post("/auth/telegram")
      .send({ initData: signInitData(runPrefix * 1_000_000 + idCounter) })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/insights/${insightId}/read`)
      .set("Authorization", `Bearer ${other.body.accessToken}`)
      .expect(404);
  });
});
