import { createHmac, randomUUID } from "node:crypto";

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
    user: JSON.stringify({ id: userId, first_name: "ReviewE2E", language_code: "ru" }),
  });
  const dataCheckString = [...params.entries()]
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join("\n");
  const secretKey = createHmac("sha256", "WebAppData").update(BOT_TOKEN).digest();
  params.set("hash", createHmac("sha256", secretKey).update(dataCheckString).digest("hex"));
  return params.toString();
}

/** Comma-separated statement rows — Date,Amount,Description. Amount is signed; negative = expense. */
const statementRow = (date: string, amount: string, merchant: string) =>
  ["Date,Amount,Description", `${date},${amount},${merchant}`].join("\n");

interface ReviewInboxItemDto {
  id: string;
  reason: string;
  transaction: { id: string; merchant: string | null; categoryId: string | null };
  suggestion: { duplicateOfTransactionId?: string; categoryId?: string; merchant?: string } | null;
}

describe("Review inbox (e2e)", () => {
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
    // This suite imports a statement several times over; stay off the free plan's cap.
    await app.get(EntitlementsService).setPlan(login.body.user.id, "pro");

    const account = await authed("post", "/accounts")
      .send({ type: "card", name: "Карта", currency: "RUB", initialBalanceMinor: 100_000_00 })
      .expect(201);
    accountId = account.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  /** Imports one row and commits it, returning the created transaction id. */
  async function importAndCommit(csv: string): Promise<string> {
    const preview = await authed("post", `/import/preview/${accountId}`)
      .attach("file", Buffer.from(csv, "utf8"), "statement.csv")
      .expect(201);
    await authed("post", `/import/${preview.body.jobId}/commit`).expect(201);
    const list = await authed("get", `/transactions?accountId=${accountId}`).expect(200);
    const merchant = csv.split("\n")[1]!.split(",")[2];
    const created = (list.body as Array<{ id: string; merchant: string | null }>).find(
      (t) => t.merchant === merchant,
    );
    if (!created) throw new Error(`Imported transaction for ${merchant} not found`);
    return created.id;
  }

  async function findReviewItem(transactionId: string): Promise<ReviewInboxItemDto> {
    const inbox = await authed("get", "/review-inbox").expect(200);
    const item = (inbox.body as ReviewInboxItemDto[]).find(
      (i) => i.transaction.id === transactionId,
    );
    if (!item) throw new Error(`No pending review item for transaction ${transactionId}`);
    return item;
  }

  it("categorize sets the category, confirms the transaction, and learns a rule for next time", async () => {
    const merchant = `Merchant-Cat-${randomUUID()}`;
    const txId = await importAndCommit(statementRow("2026-08-01", "-100.00", merchant));

    const before = await authed("get", `/transactions/${txId}`).expect(200);
    expect(before.body.categoryId).toBeNull();
    expect(before.body.status).toBe("needs_review");

    const item = await findReviewItem(txId);
    expect(item.reason).toBe("low_category_confidence");

    const category = await authed("post", "/categories")
      .send({ type: "expense", name: `Groceries-${randomUUID()}` })
      .expect(201);

    await authed("post", `/review-inbox/${item.id}/resolve`)
      .send({ action: "categorize", categoryId: category.body.id })
      .expect(204);

    const after = await authed("get", `/transactions/${txId}`).expect(200);
    expect(after.body.categoryId).toBe(category.body.id);
    expect(after.body.status).toBe("confirmed");

    const inboxAfter = await authed("get", "/review-inbox").expect(200);
    expect(
      (inboxAfter.body as ReviewInboxItemDto[]).some((i) => i.transaction.id === txId),
    ).toBe(false);

    // A rule should now exist for this merchant: a fresh preview auto-categorizes it
    // and no longer sends it to review.
    const preview = await authed("post", `/import/preview/${accountId}`)
      .attach(
        "file",
        Buffer.from(statementRow("2026-08-02", "-55.00", merchant), "utf8"),
        "statement.csv",
      )
      .expect(201);
    const row = preview.body.rows[0] as { categoryId?: string; status: string };
    expect(row.categoryId).toBe(category.body.id);
    expect(row.status).not.toBe("review");
  });

  it("confirm_duplicate soft-deletes the transaction (not a hard delete) and resolves the review item", async () => {
    const merchant = `OZON-${randomUUID()}`;
    const original = await authed("post", "/transactions")
      .send({
        type: "expense",
        accountId,
        amountMinor: 10_000,
        currency: "RUB",
        merchant,
        clientId: randomUUID(),
      })
      .expect(201);

    // Same amount, a lightly-modified merchant name — lands as a probable duplicate,
    // not an auto-skipped exact one, so a review item is created (business-rules: tier "review").
    const dupTxId = await importAndCommit(statementRow("2026-08-03", "-100.00", `${merchant}.RU`));

    const item = await findReviewItem(dupTxId);
    expect(item.reason).toBe("probable_duplicate");
    expect(item.suggestion?.duplicateOfTransactionId).toBe(original.body.id);

    await authed("post", `/review-inbox/${item.id}/resolve`)
      .send({ action: "confirm_duplicate" })
      .expect(204);

    // Soft-deleted: gone from list and single-get, but this must not be a hard delete —
    // there is no direct way to observe "still on disk" over the API, so we instead assert
    // the sibling row (the original) survives untouched and no crash/orphan occurred.
    await authed("get", `/transactions/${dupTxId}`).expect(404);
    const list = await authed("get", `/transactions?accountId=${accountId}`).expect(200);
    expect((list.body as Array<{ id: string }>).some((t) => t.id === dupTxId)).toBe(false);

    const originalAfter = await authed("get", `/transactions/${original.body.id}`).expect(200);
    expect(originalAfter.body.status).toBe("confirmed");

    const inboxAfter = await authed("get", "/review-inbox").expect(200);
    expect(
      (inboxAfter.body as ReviewInboxItemDto[]).some((i) => i.id === item.id),
    ).toBe(false);
  });

  it("not_duplicate confirms the transaction and resolves the review item", async () => {
    const merchant = `Perekrestok-${randomUUID()}`;
    await authed("post", "/transactions")
      .send({
        type: "expense",
        accountId,
        amountMinor: 20_000,
        currency: "RUB",
        merchant,
        clientId: randomUUID(),
      })
      .expect(201);

    const txId = await importAndCommit(statementRow("2026-08-04", "-200.00", `${merchant}.RU`));
    const before = await authed("get", `/transactions/${txId}`).expect(200);
    expect(before.body.status).toBe("needs_review");

    const item = await findReviewItem(txId);
    expect(item.reason).toBe("probable_duplicate");

    await authed("post", `/review-inbox/${item.id}/resolve`)
      .send({ action: "not_duplicate" })
      .expect(204);

    const after = await authed("get", `/transactions/${txId}`).expect(200);
    expect(after.body.status).toBe("confirmed");

    const inboxAfter = await authed("get", "/review-inbox").expect(200);
    expect(
      (inboxAfter.body as ReviewInboxItemDto[]).some((i) => i.id === item.id),
    ).toBe(false);
  });

  it("dismiss resolves the review item without touching the transaction", async () => {
    const merchant = `Merchant-Dismiss-${randomUUID()}`;
    const txId = await importAndCommit(statementRow("2026-08-05", "-30.00", merchant));
    const item = await findReviewItem(txId);

    await authed("post", `/review-inbox/${item.id}/resolve`).send({ action: "dismiss" }).expect(204);

    const after = await authed("get", `/transactions/${txId}`).expect(200);
    expect(after.body.categoryId).toBeNull();
    expect(after.body.status).toBe("needs_review");

    const inboxAfter = await authed("get", "/review-inbox").expect(200);
    expect(
      (inboxAfter.body as ReviewInboxItemDto[]).some((i) => i.id === item.id),
    ).toBe(false);
  });

  it("refuses to resolve an already-resolved item", async () => {
    const merchant = `Merchant-Twice-${randomUUID()}`;
    const txId = await importAndCommit(statementRow("2026-08-06", "-10.00", merchant));
    const item = await findReviewItem(txId);

    await authed("post", `/review-inbox/${item.id}/resolve`).send({ action: "dismiss" }).expect(204);
    await authed("post", `/review-inbox/${item.id}/resolve`).send({ action: "dismiss" }).expect(400);
  });

  it("prevents one user from resolving another user's review item (IDOR)", async () => {
    const merchant = `Merchant-Idor-${randomUUID()}`;
    const txId = await importAndCommit(statementRow("2026-08-07", "-15.00", merchant));
    const item = await findReviewItem(txId);

    idCounter += 1;
    const other = await request(app.getHttpServer())
      .post("/auth/telegram")
      .send({ initData: signInitData(runPrefix * 1_000_000 + idCounter) })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/review-inbox/${item.id}/resolve`)
      .set("Authorization", `Bearer ${other.body.accessToken}`)
      .send({ action: "dismiss" })
      .expect(404);
  });
});
