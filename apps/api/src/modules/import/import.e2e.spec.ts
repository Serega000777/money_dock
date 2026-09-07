import { createHmac } from "node:crypto";

import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";

import { AppModule } from "../../app.module";
import { EntitlementsService } from "../entitlements/entitlements.service";
import { EntitlementsService } from "../entitlements/entitlements.service";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "";
const runPrefix = Math.floor(Math.random() * 1_000_000);
let idCounter = 0;

function signInitData(userId: number): string {
  const params = new URLSearchParams({
    auth_date: String(Math.floor(Date.now() / 1000)),
    user: JSON.stringify({ id: userId, first_name: "ImportE2E", language_code: "ru" }),
  });
  const dataCheckString = [...params.entries()]
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join("\n");
  const secretKey = createHmac("sha256", "WebAppData").update(BOT_TOKEN).digest();
  params.set("hash", createHmac("sha256", secretKey).update(dataCheckString).digest("hex"));
  return params.toString();
}

/** Semicolon-separated with decimal commas — the shape most RU bank exports come in. */
const RU_STATEMENT = [
  "Дата операции;Сумма операции;Назначение платежа",
  "01.09.2026;-1250,50;Пятёрочка",
  "02.09.2026;-3450,00;АЗС ATAN",
  "03.09.2026;не сумма;Битая строка",
  "04.09.2026;50000,00;Зарплата",
].join("\n");

/** Comma-separated ISO/English export — the other common shape. */
const EN_STATEMENT = ["Date,Amount,Description", "2026-09-05,-42.30,Starbucks"].join("\n");

describe("Statement import (e2e)", () => {
  let app: INestApplication;
  let token: string;
  let accountId: string;

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
    // This suite covers parsing/dedup/commit mechanics; the free plan's one-import-a-month
    // cap is exercised in the entitlements suite rather than tripped over here.
    await app.get(EntitlementsService).setPlan(login.body.user.id, "pro");

    const account = await authed("post", "/accounts")
      .send({ type: "card", name: "Карта", currency: "RUB", initialBalanceMinor: 100_000_00 })
      .expect(201);
    accountId = account.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it("parses a semicolon+decimal-comma statement without losing kopeks", async () => {
    const res = await authed("post", `/import/preview/${accountId}`)
      .attach("file", Buffer.from(RU_STATEMENT, "utf8"), "statement.csv")
      .expect(201);

    const rows = res.body.rows as Array<{
      amountMinor?: number;
      merchant?: string;
      status: string;
    }>;
    const groceries = rows.find((r) => r.merchant === "Пятёрочка");
    expect(groceries?.amountMinor).toBe(125_050);
    expect(rows.find((r) => r.merchant === "АЗС ATAN")?.amountMinor).toBe(345_000);
  });

  it("reports a malformed row as an error without failing the whole job", async () => {
    const res = await authed("post", `/import/preview/${accountId}`)
      .attach("file", Buffer.from(RU_STATEMENT, "utf8"), "statement.csv")
      .expect(201);

    expect(res.body.stats.rowsFound).toBe(4);
    expect(res.body.stats.errors).toBe(1);
    const errorRow = (res.body.rows as Array<{ status: string; error?: string }>).find(
      (r) => r.status === "error",
    );
    expect(errorRow?.error).toContain("сумму");
  });

  it("infers expense/income from the amount sign", async () => {
    const res = await authed("post", `/import/preview/${accountId}`)
      .attach("file", Buffer.from(RU_STATEMENT, "utf8"), "statement.csv")
      .expect(201);

    const rows = res.body.rows as Array<{ merchant?: string; type?: string }>;
    expect(rows.find((r) => r.merchant === "Пятёрочка")?.type).toBe("expense");
    expect(rows.find((r) => r.merchant === "Зарплата")?.type).toBe("income");
  });

  it("also handles a comma-separated English export", async () => {
    const res = await authed("post", `/import/preview/${accountId}`)
      .attach("file", Buffer.from(EN_STATEMENT, "utf8"), "en.csv")
      .expect(201);

    const row = (res.body.rows as Array<{ merchant?: string; amountMinor?: number }>)[0];
    expect(row?.merchant).toBe("Starbucks");
    expect(row?.amountMinor).toBe(4_230);
  });

  it("creates nothing until commit, then creates exactly the accepted rows", async () => {
    const before = await authed("get", `/transactions?accountId=${accountId}`).expect(200);

    const preview = await authed("post", `/import/preview/${accountId}`)
      .attach("file", Buffer.from(RU_STATEMENT, "utf8"), "statement.csv")
      .expect(201);

    const afterPreview = await authed("get", `/transactions?accountId=${accountId}`).expect(200);
    expect(afterPreview.body.length).toBe(before.body.length);

    await authed("post", `/import/${preview.body.jobId}/commit`).expect(201);

    const afterCommit = await authed("get", `/transactions?accountId=${accountId}`).expect(200);
    // 4 data rows, one of which failed to parse.
    expect(afterCommit.body.length).toBe(before.body.length + 3);
  });

  it("is safe to commit twice — the second call creates no duplicates", async () => {
    const preview = await authed("post", `/import/preview/${accountId}`)
      .attach("file", Buffer.from(EN_STATEMENT, "utf8"), "en.csv")
      .expect(201);

    await authed("post", `/import/${preview.body.jobId}/commit`).expect(201);
    const afterFirst = await authed("get", `/transactions?accountId=${accountId}`).expect(200);

    await authed("post", `/import/${preview.body.jobId}/commit`).expect(201);
    const afterSecond = await authed("get", `/transactions?accountId=${accountId}`).expect(200);

    expect(afterSecond.body.length).toBe(afterFirst.body.length);
  });

  it("flags a re-uploaded identical file as already imported", async () => {
    const res = await authed("post", `/import/preview/${accountId}`)
      .attach("file", Buffer.from(EN_STATEMENT, "utf8"), "en.csv")
      .expect(201);
    expect(res.body.alreadyImportedJobId).toBeDefined();
  });

  it("detects a second import of the same rows as duplicates", async () => {
    const res = await authed("post", `/import/preview/${accountId}`)
      .attach("file", Buffer.from(RU_STATEMENT, "utf8"), "statement.csv")
      .expect(201);
    expect(res.body.stats.duplicates).toBeGreaterThan(0);
  });

  it("rejects a file whose header has no recognizable date/amount columns", async () => {
    await authed("post", `/import/preview/${accountId}`)
      .attach("file", Buffer.from("foo,bar\n1,2", "utf8"), "junk.csv")
      .expect(400);
  });

  it("refuses to import into another user's account (IDOR)", async () => {
    idCounter += 1;
    const other = await request(app.getHttpServer())
      .post("/auth/telegram")
      .send({ initData: signInitData(runPrefix * 1_000_000 + idCounter) })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/import/preview/${accountId}`)
      .set("Authorization", `Bearer ${other.body.accessToken}`)
      .attach("file", Buffer.from(EN_STATEMENT, "utf8"), "en.csv")
      .expect(404);
  });
});
