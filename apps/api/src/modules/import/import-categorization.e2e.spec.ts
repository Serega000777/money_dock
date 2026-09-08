import { createHmac } from "node:crypto";

import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";

import { AppModule } from "../../app.module";
import { EntitlementsService } from "../entitlements/entitlements.service";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "";
const runPrefix = Math.floor(Math.random() * 1_000_000);

function signInitData(userId: number): string {
  const params = new URLSearchParams({
    auth_date: String(Math.floor(Date.now() / 1000)),
    user: JSON.stringify({ id: userId, first_name: "ImportCatE2E", language_code: "ru" }),
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
 * Import's dedup/parsing mechanics are covered in import.e2e.spec.ts; this file is only
 * the new categorization pipeline steps (global alias, MCC, local classifier) added
 * alongside them. Kept in its own suite (own app instance, own IMPORT_THROTTLE budget of
 * 10/60s) so it doesn't compete with that file's already-tight request count.
 */
describe("Statement import — categorization pipeline (e2e)", () => {
  let app: INestApplication;
  let token: string;
  let accountId: string;

  const authed = (method: "get" | "post", path: string) =>
    request(app.getHttpServer())[method](path).set("Authorization", `Bearer ${token}`);

  async function categoryIdFor(systemCode: string): Promise<string> {
    const res = await authed("get", "/categories");
    const category = (res.body as Array<{ id: string; systemCode: string | null }>).find(
      (c) => c.systemCode === systemCode,
    );
    if (!category) throw new Error(`System category not seeded: ${systemCode}`);
    return category.id;
  }

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
    await app.get(EntitlementsService).setPlan(login.body.user.id, "pro");

    const account = await authed("post", "/accounts")
      .send({ type: "card", name: "Карта", currency: "RUB", initialBalanceMinor: 100_000_00 })
      .expect(201);
    accountId = account.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it("auto-categorizes via the global merchant alias, above the review bar", async () => {
    const groceriesCategoryId = await categoryIdFor("groceries");
    // A distinct amount so this row can't be mistaken for a duplicate of anything else
    // this suite creates — the point here is the alias match, not dedup.
    const statement = ["Дата;Сумма;Назначение", "01.09.2026;-777,00;Пятёрочка"].join("\n");

    const res = await authed("post", `/import/preview/${accountId}`)
      .attach("file", Buffer.from(statement, "utf8"), "alias.csv")
      .expect(201);

    const row = (res.body.rows as Array<{ categoryId?: string | null; status: string }>)[0];
    expect(row?.categoryId).toBe(groceriesCategoryId);
    expect(row?.status).toBe("new"); // confidence 70 clears the review bar (60)
  });

  it("categorizes via MCC below the review bar, and Review Inbox shows the suggestion", async () => {
    const fuelCategoryId = await categoryIdFor("fuel");
    const statement = [
      "Дата;Сумма;Назначение;MCC",
      "02.09.2026;-500,00;Неизвестный продавец 42;5541",
    ].join("\n");

    const preview = await authed("post", `/import/preview/${accountId}`)
      .attach("file", Buffer.from(statement, "utf8"), "mcc.csv")
      .expect(201);

    const row = (preview.body.rows as Array<{ categoryId?: string | null; status: string }>)[0];
    expect(row?.categoryId).toBe(fuelCategoryId);
    expect(row?.status).toBe("review"); // MCC confidence (55) is below the threshold (60)

    await authed("post", `/import/${preview.body.jobId}/commit`).expect(201);
    const inbox = await authed("get", "/review-inbox").expect(200);
    const item = (
      inbox.body as Array<{ suggestion: { categoryId?: string } | null; reason: string }>
    ).find((i) => i.suggestion?.categoryId === fuelCategoryId);
    expect(item?.reason).toBe("low_category_confidence");
  });

  it("falls back to the local keyword classifier when nothing else matches", async () => {
    const restaurantsCategoryId = await categoryIdFor("restaurants");
    const statement = ["Дата;Сумма;Назначение", "03.09.2026;-300,00;Кафе Уют на районе"].join(
      "\n",
    );

    const res = await authed("post", `/import/preview/${accountId}`)
      .attach("file", Buffer.from(statement, "utf8"), "keyword.csv")
      .expect(201);

    const row = (res.body.rows as Array<{ categoryId?: string | null; status: string }>)[0];
    expect(row?.categoryId).toBe(restaurantsCategoryId);
    expect(row?.status).toBe("review"); // keyword-match confidence (40) is the weakest signal
  });
});
