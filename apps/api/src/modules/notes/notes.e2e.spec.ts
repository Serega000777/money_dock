import { createHmac, randomUUID } from "node:crypto";

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
    user: JSON.stringify({ id: userId, first_name: "NotesE2E", language_code: "ru" }),
  });
  const dataCheckString = [...params.entries()]
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join("\n");
  const secretKey = createHmac("sha256", "WebAppData").update(BOT_TOKEN).digest();
  params.set("hash", createHmac("sha256", secretKey).update(dataCheckString).digest("hex"));
  return params.toString();
}

describe("Notes and hands-free capture (e2e)", () => {
  let app: INestApplication;
  let token: string;

  const authed = (method: "get" | "post" | "patch" | "delete", path: string, jwt = token) =>
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
    await authed("post", "/accounts")
      .send({ type: "cash", name: "Наличные", currency: "RUB", initialBalanceMinor: 500_000 })
      .expect(201);
  });

  afterAll(async () => {
    await app.close();
  });

  it("creates, lists, updates and deletes a note", async () => {
    const created = await authed("post", "/notes")
      .send({ title: "Страховка", body: "15 000 до 20 числа", colorIndex: 3 })
      .expect(201);
    expect(created.body).toMatchObject({ title: "Страховка", colorIndex: 3, pinned: false });

    const pinned = await authed("patch", `/notes/${created.body.id}`)
      .send({ pinned: true })
      .expect(200);
    expect(pinned.body.pinned).toBe(true);

    const list = await authed("get", "/notes").expect(200);
    expect(list.body.map((n: { id: string }) => n.id)).toContain(created.body.id);

    await authed("delete", `/notes/${created.body.id}`).expect(204);
    const after = await authed("get", "/notes").expect(200);
    expect(after.body.map((n: { id: string }) => n.id)).not.toContain(created.body.id);
  });

  it("keeps notes private to their owner", async () => {
    const created = await authed("post", "/notes").send({ title: "Личное" }).expect(201);
    const stranger = await newUser();

    await authed("get", "/notes", stranger.accessToken).expect(200);
    await authed("patch", `/notes/${created.body.id}`, stranger.accessToken)
      .send({ title: "Взлом" })
      .expect(404);
    await authed("delete", `/notes/${created.body.id}`, stranger.accessToken).expect(404);
  });

  it("saves a captured phrase unconfirmed and queues it for review", async () => {
    const res = await authed("post", "/commands/capture")
      .send({ text: "потратил 640 рублей в кафе", source: "voice", clientId: randomUUID() })
      .expect(201);

    expect(res.body).toMatchObject({ amountMinor: 64_000, status: "needs_review", source: "voice" });

    const inbox = await authed("get", "/review-inbox").expect(200);
    const item = inbox.body.find(
      (i: { transaction: { id: string } }) => i.transaction.id === res.body.id,
    );
    expect(item?.reason).toBe("unconfirmed_capture");
  });

  it("does not duplicate a capture that is retried with the same clientId", async () => {
    const clientId = randomUUID();
    const body = { text: "потратил 300 рублей", source: "text" as const, clientId };

    const first = await authed("post", "/commands/capture").send(body).expect(201);
    const second = await authed("post", "/commands/capture").send(body).expect(201);

    expect(second.body.id).toBe(first.body.id);
  });
});
