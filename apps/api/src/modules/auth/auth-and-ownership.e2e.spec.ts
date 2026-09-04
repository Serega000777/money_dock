import { createHmac } from "node:crypto";

import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";

import { AppModule } from "../../app.module";

/**
 * Exercises the real HTTP stack against a real Postgres (see infrastructure/docker and
 * CI). Requires migrations to already be applied — see README "Быстрый старт" / CI workflow.
 */

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "";

function signInitData(userId: number): string {
  const params = new URLSearchParams({
    auth_date: String(Math.floor(Date.now() / 1000)),
    user: JSON.stringify({ id: userId, first_name: "E2E", language_code: "ru" }),
  });
  const dataCheckString = [...params.entries()]
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join("\n");
  const secretKey = createHmac("sha256", "WebAppData").update(BOT_TOKEN).digest();
  params.set("hash", createHmac("sha256", secretKey).update(dataCheckString).digest("hex"));
  return params.toString();
}

// Date.now() alone risks collisions with data left over by a previous run of this same
// suite (Postgres isn't reset between runs) — a per-run random prefix plus a monotonic
// counter keeps every generated Telegram id unique within and across runs.
let idCounter = 0;
const runPrefix = Math.floor(Math.random() * 1_000_000);
function nextTelegramUserId(): number {
  idCounter += 1;
  return runPrefix * 1_000_000 + idCounter;
}

async function loginAsNewUser(app: INestApplication, userId: number) {
  const res = await request(app.getHttpServer())
    .post("/auth/telegram")
    .send({ initData: signInitData(userId) })
    .expect(200);
  return res.body as { accessToken: string; refreshToken: string; user: { id: string } };
}

describe("Auth + ownership (e2e)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    if (!BOT_TOKEN) throw new Error("TELEGRAM_BOT_TOKEN must be set to run this suite");
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("rejects initData with an invalid signature", async () => {
    // Appending an extra field changes the data-check-string without touching `hash` itself,
    // so this actually invalidates the signature (unlike mutating `hash`, where an odd
    // trailing hex nibble gets silently dropped by Buffer.from(..., "hex")).
    await request(app.getHttpServer())
      .post("/auth/telegram")
      .send({ initData: `${signInitData(nextTelegramUserId())}&tampered=1` })
      .expect(401);
  });

  it("rejects requests to protected routes without a token", async () => {
    await request(app.getHttpServer()).get("/users/me").expect(401);
  });

  it("logs in the same Telegram user to the same account on repeat login", async () => {
    const userId = nextTelegramUserId();
    const first = await loginAsNewUser(app, userId);
    const second = await loginAsNewUser(app, userId);
    expect(second.user.id).toBe(first.user.id);
  });

  it("rotates refresh tokens and rejects reuse of a rotated token", async () => {
    const { refreshToken } = await loginAsNewUser(app, nextTelegramUserId());

    const rotated = await request(app.getHttpServer())
      .post("/auth/refresh")
      .send({ refreshToken })
      .expect(200);
    expect(rotated.body.refreshToken).not.toBe(refreshToken);

    await request(app.getHttpServer()).post("/auth/refresh").send({ refreshToken }).expect(401);
  });

  it("revokes a session on logout so it can no longer be refreshed", async () => {
    const { refreshToken } = await loginAsNewUser(app, nextTelegramUserId());
    await request(app.getHttpServer()).post("/auth/logout").send({ refreshToken }).expect(204);
    await request(app.getHttpServer()).post("/auth/refresh").send({ refreshToken }).expect(401);
  });

  it("prevents one user from reading, editing, or deleting another user's account (IDOR)", async () => {
    const owner = await loginAsNewUser(app, nextTelegramUserId());
    const intruder = await loginAsNewUser(app, nextTelegramUserId());

    const created = await request(app.getHttpServer())
      .post("/accounts")
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ type: "cash", name: "Кошелёк", currency: "RUB", initialBalanceMinor: 5000 })
      .expect(201);
    const accountId = created.body.id as string;

    await request(app.getHttpServer())
      .get(`/accounts/${accountId}`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .get(`/accounts/${accountId}`)
      .set("Authorization", `Bearer ${intruder.accessToken}`)
      .expect(404);

    await request(app.getHttpServer())
      .patch(`/accounts/${accountId}`)
      .set("Authorization", `Bearer ${intruder.accessToken}`)
      .send({ name: "Захвачено" })
      .expect(404);

    await request(app.getHttpServer())
      .delete(`/accounts/${accountId}`)
      .set("Authorization", `Bearer ${intruder.accessToken}`)
      .expect(404);
  });

  it("prevents one user from deleting another user's custom category", async () => {
    const owner = await loginAsNewUser(app, nextTelegramUserId());
    const intruder = await loginAsNewUser(app, nextTelegramUserId());

    const created = await request(app.getHttpServer())
      .post("/categories")
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ type: "expense", name: "Хобби" })
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/categories/${created.body.id}`)
      .set("Authorization", `Bearer ${intruder.accessToken}`)
      .expect(404);
  });

  it("never lets a custom category masquerade as a system category (nobody can delete system ones)", async () => {
    const user = await loginAsNewUser(app, nextTelegramUserId());
    const list = await request(app.getHttpServer())
      .get("/categories")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .expect(200);

    const systemCategory = (list.body as Array<{ isSystem: boolean; id: string }>).find(
      (c) => c.isSystem,
    );
    if (!systemCategory) return; // seed not run in this environment — nothing to assert.

    await request(app.getHttpServer())
      .delete(`/categories/${systemCategory.id}`)
      .set("Authorization", `Bearer ${user.accessToken}`)
      .expect(404);
  });
});
