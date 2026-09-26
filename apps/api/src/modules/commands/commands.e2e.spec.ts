import { createHmac } from "node:crypto";

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
    user: JSON.stringify({ id: userId, first_name: "CmdE2E", language_code: "ru" }),
  });
  const dataCheckString = [...params.entries()]
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join("\n");
  const secretKey = createHmac("sha256", "WebAppData").update(BOT_TOKEN).digest();
  params.set("hash", createHmac("sha256", secretKey).update(dataCheckString).digest("hex"));
  return params.toString();
}

describe("Voice/text commands + entitlements (e2e)", () => {
  let app: INestApplication;
  let entitlements: EntitlementsService;
  let token: string;
  let userId: string;

  const authed = (method: "get" | "post", path: string) =>
    request(app.getHttpServer())[method](path).set("Authorization", `Bearer ${token}`);

  async function newUser() {
    idCounter += 1;
    const res = await request(app.getHttpServer())
      .post("/auth/telegram")
      .send({ initData: signInitData(runPrefix * 1_000_000 + idCounter) })
      .expect(200);
    return res.body as { accessToken: string; user: { id: string } };
  }

  beforeAll(async () => {
    if (!BOT_TOKEN) throw new Error("TELEGRAM_BOT_TOKEN must be set to run this suite");
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    entitlements = app.get(EntitlementsService);

    const login = await newUser();
    token = login.accessToken;
    userId = login.user.id;

    await authed("post", "/accounts")
      .send({ type: "cash", name: "Наличные", currency: "RUB", initialBalanceMinor: 0 })
      .expect(201);
  });

  afterAll(async () => {
    await app.close();
  });

  it("turns a full spoken phrase into a draft with account and category resolved", async () => {
    const res = await authed("post", "/commands/parse")
      .send({ text: "Вчера потратил 840 рублей в кафе с наличных", source: "text" })
      .expect(200);

    expect(res.body).toMatchObject({ type: "expense", amountMinor: 84_000 });
    expect(res.body.categoryName).toBe("Кафе и рестораны");
    expect(res.body.accountName).toBe("Наличные");
    expect(res.body.confidence).toBeGreaterThan(0.85);
  });

  it("explains which parts it recognized, so the confirmation card can show why", async () => {
    const res = await authed("post", "/commands/parse")
      .send({ text: "потратил 2500 на бензин", source: "text" })
      .expect(200);
    expect(res.body.explanation).toEqual(
      expect.arrayContaining(["сумма", "тип операции", "категория"]),
    );
  });

  it("falls back to the brand-alias pipeline when the parser has no keyword for it", async () => {
    const res = await authed("post", "/commands/parse")
      .send({ text: "потратил 3000 в лукойле", source: "text" })
      .expect(200);
    expect(res.body.categoryName).toBe("Топливо");
    expect(res.body.explanation).toContain("категория");
  });

  it("always proposes a category — «Другое» when nothing else fits", async () => {
    const expense = await authed("post", "/commands/parse")
      .send({ text: "потратил 700 рублей", source: "text" })
      .expect(200);
    expect(expense.body.categoryName).toBe("Другое");
    expect(expense.body.explanation).not.toContain("категория");

    const income = await authed("post", "/commands/parse")
      .send({ text: "мне перевели 5000", source: "text" })
      .expect(200);
    expect(income.body.type).toBe("income");
    expect(income.body.categoryName).toBe("Другое");
  });

  it("resolves income to an income category", async () => {
    const res = await authed("post", "/commands/parse")
      .send({ text: "получил 15000 за проект от клиента", source: "text" })
      .expect(200);
    expect(res.body).toMatchObject({ type: "income", amountMinor: 1_500_000 });
    expect(res.body.categoryName).toBe("Подработка");
  });

  it("never creates a transaction — parsing only returns a draft", async () => {
    const before = await authed("get", "/transactions").expect(200);
    await authed("post", "/commands/parse")
      .send({ text: "потратил 500", source: "text" })
      .expect(200);
    const after = await authed("get", "/transactions").expect(200);
    expect(after.body.length).toBe(before.body.length);
  });

  it("rejects a phrase with no amount instead of guessing one", async () => {
    await authed("post", "/commands/parse")
      .send({ text: "купил что-то вкусное", source: "text" })
      .expect(400);
  });

  it("does not meter typed commands", async () => {
    const fresh = await newUser();
    for (let i = 0; i < 3; i++) {
      await request(app.getHttpServer())
        .post("/commands/parse")
        .set("Authorization", `Bearer ${fresh.accessToken}`)
        .send({ text: "потратил 100", source: "text" })
        .expect(200);
    }
    const state = await request(app.getHttpServer())
      .get("/entitlements")
      .set("Authorization", `Bearer ${fresh.accessToken}`)
      .expect(200);
    expect(state.body.used.voice).toBe(0);
  });

  it("meters voice on the free plan and blocks past the limit", async () => {
    const fresh = await newUser();
    const voice = (t: string) =>
      request(app.getHttpServer())
        .post("/commands/parse")
        .set("Authorization", `Bearer ${fresh.accessToken}`)
        .send({ text: t, source: "voice" });

    for (let i = 0; i < 10; i++) await voice("потратил 100").expect(200);

    const blocked = await voice("потратил 100").expect(403);
    expect(String(blocked.body.message)).toContain("Pro");
  });

  it("lifts the voice limit on Pro", async () => {
    const fresh = await newUser();
    await entitlements.setPlan(fresh.user.id, "pro");

    // Checked through the service: driving 12 requests at the endpoint would hit its own
    // rate limit, which is a different guard from the plan limit under test here.
    for (let i = 0; i < 12; i++) {
      await expect(entitlements.consume(fresh.user.id, "voice")).resolves.toBeUndefined();
    }

    // And the endpoint still works for a Pro user past what free would have allowed.
    await request(app.getHttpServer())
      .post("/commands/parse")
      .set("Authorization", `Bearer ${fresh.accessToken}`)
      .send({ text: "потратил 100", source: "voice" })
      .expect(200);
  });

  it("treats an expired paid plan as free", async () => {
    const fresh = await newUser();
    await entitlements.setPlan(fresh.user.id, "pro", new Date(Date.now() - 86_400_000));

    const state = await request(app.getHttpServer())
      .get("/entitlements")
      .set("Authorization", `Bearer ${fresh.accessToken}`)
      .expect(200);
    expect(state.body.plan).toBe("free");
  });

  it("gives the free plan exactly one statement import a month", async () => {
    const fresh = await newUser();
    await expect(entitlements.consume(fresh.user.id, "import")).resolves.toBeUndefined();
    await expect(entitlements.consume(fresh.user.id, "import")).rejects.toThrow(/Pro/);
  });

  it("reports the current plan and usage", async () => {
    const res = await authed("get", "/entitlements").expect(200);
    expect(res.body.plan).toBe("free");
    expect(res.body.limits.voice).toBe(10);
    expect(typeof res.body.used.voice).toBe("number");
    expect(userId).toBeTruthy();
  });

  describe("transcribe — the iOS path (no client-side SpeechRecognition)", () => {
    afterEach(() => jest.restoreAllMocks());

    function mockGemini(text: string) {
      return jest.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }),
      } as Response);
    }

    it("turns a recorded clip into the same kind of draft parse() returns", async () => {
      mockGemini("Потратил 500 рублей на кофе");

      const res = await authed("post", "/commands/transcribe")
        .attach("audio", Buffer.from("fake-audio-bytes"), "clip.webm")
        .expect(200);

      expect(res.body).toMatchObject({ type: "expense", amountMinor: 50_000 });
      expect(res.body.categoryName).toBe("Кафе и рестораны");
    });

    it("meters it as voice, same as the browser-recognized path", async () => {
      const fresh = await newUser();
      mockGemini("потратил 100");

      await request(app.getHttpServer())
        .post("/commands/transcribe")
        .set("Authorization", `Bearer ${fresh.accessToken}`)
        .attach("audio", Buffer.from("x"), "clip.webm")
        .expect(200);

      const state = await request(app.getHttpServer())
        .get("/entitlements")
        .set("Authorization", `Bearer ${fresh.accessToken}`)
        .expect(200);
      expect(state.body.used.voice).toBe(1);
    });

    it("rejects with no audio attached", async () => {
      await authed("post", "/commands/transcribe").expect(400);
    });

    it("surfaces a clear error when Gemini has nothing to say, instead of crashing", async () => {
      jest.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => ({ candidates: [] }),
      } as Response);

      await authed("post", "/commands/transcribe")
        .attach("audio", Buffer.from("silence"), "clip.webm")
        .expect(400);
    });

    it("surfaces a clear error when Gemini itself fails", async () => {
      jest.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: false,
        status: 503,
        text: async () => "upstream unavailable",
      } as Response);

      await authed("post", "/commands/transcribe")
        .attach("audio", Buffer.from("x"), "clip.webm")
        .expect(500);
    });
  });
});
