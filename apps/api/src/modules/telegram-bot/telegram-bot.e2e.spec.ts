import { createHmac } from "node:crypto";

import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { and, eq } from "drizzle-orm";
import request from "supertest";

import { AppModule } from "../../app.module";
import type { Database } from "../../db/client";
import { DATABASE } from "../../db/database.token";
import { userIdentities } from "../../db/schema";
import { EntitlementsService } from "../entitlements/entitlements.service";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "";
const WEBHOOK_SECRET = "test-webhook-secret";
const runPrefix = Math.floor(Math.random() * 1_000_000);

function signInitData(userId: number): string {
  const params = new URLSearchParams({
    auth_date: String(Math.floor(Date.now() / 1000)),
    user: JSON.stringify({ id: userId, first_name: "StarsE2E", language_code: "ru" }),
  });
  const dataCheckString = [...params.entries()]
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join("\n");
  const secretKey = createHmac("sha256", "WebAppData").update(BOT_TOKEN).digest();
  params.set("hash", createHmac("sha256", secretKey).update(dataCheckString).digest("hex"));
  return params.toString();
}

describe("Telegram bot webhook (e2e)", () => {
  let app: INestApplication;
  let db: Database;
  let entitlements: EntitlementsService;

  beforeAll(async () => {
    if (!BOT_TOKEN) throw new Error("TELEGRAM_BOT_TOKEN must be set to run this suite");
    process.env.TELEGRAM_WEBHOOK_SECRET = WEBHOOK_SECRET;

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    db = moduleRef.get(DATABASE);
    entitlements = moduleRef.get(EntitlementsService);
  });

  afterAll(async () => {
    delete process.env.TELEGRAM_WEBHOOK_SECRET;
    await app.close();
  });

  it("rejects a call with no secret and one with the wrong secret", async () => {
    await request(app.getHttpServer())
      .post("/telegram/webhook")
      .send({ message: { chat: { id: 1 }, from: { id: 1, first_name: "X" }, text: "/start" } })
      .expect(401);

    await request(app.getHttpServer())
      .post("/telegram/webhook")
      .set("X-Telegram-Bot-Api-Secret-Token", "wrong")
      .send({ message: { chat: { id: 1 }, from: { id: 1, first_name: "X" }, text: "/start" } })
      .expect(401);
  });

  it("/start registers the Telegram user (idempotently)", async () => {
    const telegramId = runPrefix * 1_000_000 + 1;
    const update = {
      message: {
        chat: { id: telegramId },
        from: { id: telegramId, first_name: "БотE2E", language_code: "ru" },
        text: "/start",
      },
    };

    await request(app.getHttpServer())
      .post("/telegram/webhook")
      .set("X-Telegram-Bot-Api-Secret-Token", WEBHOOK_SECRET)
      .send(update)
      .expect(200);
    // A second /start (e.g. the user taps it again) must not create a second account.
    await request(app.getHttpServer())
      .post("/telegram/webhook")
      .set("X-Telegram-Bot-Api-Secret-Token", WEBHOOK_SECRET)
      .send(update)
      .expect(200);

    const [identity] = await db
      .select()
      .from(userIdentities)
      .where(
        and(eq(userIdentities.provider, "telegram"), eq(userIdentities.providerUserId, String(telegramId))),
      );
    expect(identity).toBeDefined();
  });

  it("records the shared phone number on the existing identity, only from the sender's own contact", async () => {
    const telegramId = runPrefix * 1_000_000 + 2;
    const from = { id: telegramId, first_name: "СКонтактом", language_code: "ru" };

    await request(app.getHttpServer())
      .post("/telegram/webhook")
      .set("X-Telegram-Bot-Api-Secret-Token", WEBHOOK_SECRET)
      .send({ message: { chat: { id: telegramId }, from, text: "/start" } })
      .expect(200);

    // Someone else's shared contact card — must be ignored.
    await request(app.getHttpServer())
      .post("/telegram/webhook")
      .set("X-Telegram-Bot-Api-Secret-Token", WEBHOOK_SECRET)
      .send({
        message: {
          chat: { id: telegramId },
          from,
          contact: { phone_number: "+70000000000", user_id: telegramId + 999 },
        },
      })
      .expect(200);

    let [identity] = await db
      .select()
      .from(userIdentities)
      .where(
        and(eq(userIdentities.provider, "telegram"), eq(userIdentities.providerUserId, String(telegramId))),
      );
    expect(identity.phone).toBeNull();

    // The sender's own contact — must be recorded.
    await request(app.getHttpServer())
      .post("/telegram/webhook")
      .set("X-Telegram-Bot-Api-Secret-Token", WEBHOOK_SECRET)
      .send({
        message: {
          chat: { id: telegramId },
          from,
          contact: { phone_number: "+79991234567", user_id: telegramId },
        },
      })
      .expect(200);

    [identity] = await db
      .select()
      .from(userIdentities)
      .where(
        and(eq(userIdentities.provider, "telegram"), eq(userIdentities.providerUserId, String(telegramId))),
      );
    expect(identity.phone).toBe("+79991234567");
  });

  it("grants Pro on a successful Stars payment, keyed by the invoice payload", async () => {
    const telegramId = runPrefix * 1_000_000 + 3;
    const login = await request(app.getHttpServer())
      .post("/auth/telegram")
      .send({ initData: signInitData(telegramId) })
      .expect(200);
    const userId = login.body.user.id as string;
    expect(await entitlements.getPlan(userId)).toBe("free");

    await request(app.getHttpServer())
      .post("/telegram/webhook")
      .set("X-Telegram-Bot-Api-Secret-Token", WEBHOOK_SECRET)
      .send({
        message: {
          chat: { id: telegramId },
          from: { id: telegramId, first_name: "StarsE2E" },
          successful_payment: {
            currency: "XTR",
            total_amount: 199,
            invoice_payload: `pro_monthly:${userId}`,
            telegram_payment_charge_id: "test-charge-id",
          },
        },
      })
      .expect(200);

    expect(await entitlements.getPlan(userId)).toBe("pro");
  });

  it("ignores a successful_payment with a payload it doesn't recognize, instead of crashing", async () => {
    await request(app.getHttpServer())
      .post("/telegram/webhook")
      .set("X-Telegram-Bot-Api-Secret-Token", WEBHOOK_SECRET)
      .send({
        message: {
          chat: { id: 1 },
          from: { id: 1, first_name: "X" },
          successful_payment: {
            currency: "XTR",
            total_amount: 199,
            invoice_payload: "not-a-real-payload",
            telegram_payment_charge_id: "test-charge-id-2",
          },
        },
      })
      .expect(200);
  });
});
