import { createHmac } from "node:crypto";

import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";

import { AppModule } from "../../app.module";
import { EntitlementsService } from "../entitlements/entitlements.service";

// pdf-parse (PDF.js) sets up a worker via a dynamic import() that Jest's CJS module
// system refuses outside --experimental-vm-modules — and that flag breaks this project's
// unrelated @nestjs/jwt transform setup, so it's not an option. Confirmed separately
// against a real multipart upload through the live dev server (not under Jest) that
// ImportService.parsePdf's actual pdf-parse calls work; this mock lets the PDF-specific
// tests below exercise everything downstream of "here's the extracted text" — the part
// that's actually this project's code — the same way deepseek/gigachat provider specs
// mock fetch instead of hitting the real API.
const mockGetText = jest.fn();
const mockGetTable = jest.fn();
jest.mock("pdf-parse", () => ({
  PDFParse: jest.fn().mockImplementation(() => ({
    getText: mockGetText,
    getTable: mockGetTable,
    destroy: jest.fn().mockResolvedValue(undefined),
  })),
}));

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

// The actual bytes don't matter — parsing is mocked above — just a buffer whose filename
// ends in .pdf so ImportService routes it to parsePdf instead of parseCsv.
const PDF_PLACEHOLDER = Buffer.from("%PDF-1.4 placeholder, see mock above");

/** No table/grid lines — getTable finds nothing, forcing the text-token fallback path. */
const PDF_STATEMENT_TEXT = [
  "Date Amount Description",
  "2026-09-01 -500.00 Produkty",
  "2026-09-05 10000.00 Zarplata",
  "2026-09-10 -1200.50 AZS Gazprom",
].join("\n");

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

// Own app instance (own ThrottlerStorageService, in-memory and scoped per app) so these
// don't share the 10-req/60s import throttle budget with the CSV suite above.
describe("PDF statement import (e2e)", () => {
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
    await app.get(EntitlementsService).setPlan(login.body.user.id, "pro");

    const account = await authed("post", "/accounts")
      .send({ type: "card", name: "Карта", currency: "RUB", initialBalanceMinor: 100_000_00 })
      .expect(201);
    accountId = account.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    mockGetTable.mockReset();
    mockGetText.mockReset();
  });

  it("parses a PDF statement with no table lines by locating date/amount tokens in the text", async () => {
    mockGetTable.mockResolvedValueOnce({ mergedTables: [], pages: [{ tables: [] }] });
    mockGetText.mockResolvedValueOnce({ text: PDF_STATEMENT_TEXT });

    const res = await authed("post", `/import/preview/${accountId}`)
      .attach("file", PDF_PLACEHOLDER, "statement.pdf")
      .expect(201);
    expect(res.body.stats.rowsFound).toBe(3);
    const merchants = res.body.rows.map((row: { merchant: string | null }) => row.merchant);
    expect(merchants).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Produkty"),
        expect.stringContaining("Zarplata"),
        expect.stringContaining("AZS Gazprom"),
      ]),
    );
    const salaryRow = res.body.rows.find((row: { merchant: string | null }) =>
      row.merchant?.includes("Zarplata"),
    );
    expect(salaryRow.type).toBe("income");
    expect(salaryRow.amountMinor).toBe(1_000_000);
  });

  it("rejects a PDF with no date-and-amount-shaped lines at all", async () => {
    mockGetTable.mockResolvedValueOnce({ mergedTables: [], pages: [{ tables: [] }] });
    mockGetText.mockResolvedValueOnce({ text: "Statement summary\nNo transactions this period" });

    await authed("post", `/import/preview/${accountId}`)
      .attach("file", PDF_PLACEHOLDER, "empty.pdf")
      .expect(400);
  });

  it("prefers a detected table over the text fallback when getTable finds one", async () => {
    mockGetTable.mockResolvedValueOnce({
      mergedTables: [
        [
          ["Дата", "Сумма", "Описание"],
          ["2026-09-07", "-777.00", "Табличная строка"],
        ],
      ],
      pages: [{ tables: [] }],
    });

    const res = await authed("post", `/import/preview/${accountId}`)
      .attach("file", PDF_PLACEHOLDER, "table.pdf")
      .expect(201);
    expect(res.body.stats.rowsFound).toBe(1);
    expect(res.body.rows[0].merchant).toBe("Табличная строка");
    expect(mockGetText).not.toHaveBeenCalled();
  });
});
