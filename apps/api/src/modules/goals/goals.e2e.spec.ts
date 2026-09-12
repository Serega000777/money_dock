import { createHmac } from "node:crypto";

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
    user: JSON.stringify({ id: userId, first_name: "GoalsE2E", language_code: "ru" }),
  });
  const dataCheckString = [...params.entries()]
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join("\n");
  const secretKey = createHmac("sha256", "WebAppData").update(BOT_TOKEN).digest();
  params.set("hash", createHmac("sha256", secretKey).update(dataCheckString).digest("hex"));
  return params.toString();
}

describe("Savings goals (e2e)", () => {
  let app: INestApplication;
  let token: string;

  const authed = (method: "get" | "post" | "delete", path: string, jwt = token) =>
    request(app.getHttpServer())[method](path).set("Authorization", `Bearer ${jwt}`);

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
    token = (await newUser()).accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it("creates a goal, puts money aside, takes some back, and deletes it", async () => {
    const created = await authed("post", "/goals")
      .send({ name: "Отпуск", icon: "palm", targetMinor: 200_000_00, currency: "RUB" })
      .expect(201);
    expect(created.body).toMatchObject({
      name: "Отпуск",
      icon: "palm",
      targetMinor: 200_000_00,
      savedMinor: 0,
      deadline: null,
    });

    const added = await authed("post", `/goals/${created.body.id}/contribute`)
      .send({ amountMinor: 84_000_00 })
      .expect(201);
    expect(added.body.savedMinor).toBe(84_000_00);

    const taken = await authed("post", `/goals/${created.body.id}/contribute`)
      .send({ amountMinor: -4_000_00 })
      .expect(201);
    expect(taken.body.savedMinor).toBe(80_000_00);

    const list = await authed("get", "/goals").expect(200);
    expect(list.body.map((g: { id: string }) => g.id)).toContain(created.body.id);

    await authed("delete", `/goals/${created.body.id}`).expect(204);
    const after = await authed("get", "/goals").expect(200);
    expect(after.body.map((g: { id: string }) => g.id)).not.toContain(created.body.id);
  });

  it("refuses to take back more than was put aside, and a zero contribution", async () => {
    const goal = await authed("post", "/goals")
      .send({ name: "Подушка", targetMinor: 100_000_00, currency: "RUB" })
      .expect(201);

    await authed("post", `/goals/${goal.body.id}/contribute`)
      .send({ amountMinor: -1 })
      .expect(400);
    await authed("post", `/goals/${goal.body.id}/contribute`)
      .send({ amountMinor: 0 })
      .expect(400);

    const unchanged = await authed("get", "/goals").expect(200);
    const row = unchanged.body.find((g: { id: string }) => g.id === goal.body.id);
    expect(row.savedMinor).toBe(0);
  });

  it("keeps goals private to their owner", async () => {
    const goal = await authed("post", "/goals")
      .send({ name: "Личное", targetMinor: 1_000_00, currency: "RUB" })
      .expect(201);
    const stranger = await newUser();

    const theirs = await authed("get", "/goals", stranger.accessToken).expect(200);
    expect(theirs.body.map((g: { id: string }) => g.id)).not.toContain(goal.body.id);
    await authed("post", `/goals/${goal.body.id}/contribute`, stranger.accessToken)
      .send({ amountMinor: 1_00 })
      .expect(404);
    await authed("delete", `/goals/${goal.body.id}`, stranger.accessToken).expect(404);
  });
});
