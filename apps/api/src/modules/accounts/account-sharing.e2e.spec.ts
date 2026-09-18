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
    user: JSON.stringify({ id: userId, first_name: "ShareE2E", language_code: "ru" }),
  });
  const dataCheckString = [...params.entries()]
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join("\n");
  const secretKey = createHmac("sha256", "WebAppData").update(BOT_TOKEN).digest();
  params.set("hash", createHmac("sha256", secretKey).update(dataCheckString).digest("hex"));
  return params.toString();
}

describe("Shared accounts (e2e)", () => {
  let app: INestApplication;

  const authed = (method: "get" | "post" | "patch" | "delete", path: string, token: string) =>
    request(app.getHttpServer())[method](path).set("Authorization", `Bearer ${token}`);

  async function newUser() {
    idCounter += 1;
    const res = await request(app.getHttpServer())
      .post("/auth/telegram")
      .send({ initData: signInitData(runPrefix * 1_000_000 + idCounter) })
      .expect(200);
    return { token: res.body.accessToken as string, userId: res.body.user.id as string };
  }

  async function joinViaInvite(accountId: string, ownerToken: string, role: "member" | "viewer", memberToken: string) {
    const invite = await authed("post", `/accounts/${accountId}/invites`, ownerToken)
      .send({ role, expiresInHours: 24, maxUses: 1 })
      .expect(201);
    await authed("post", `/accounts/invites/${invite.body.token}/accept`, memberToken).expect(201);
    return invite.body.token as string;
  }

  beforeAll(async () => {
    if (!BOT_TOKEN) throw new Error("TELEGRAM_BOT_TOKEN must be set to run this suite");
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("a member can add a transaction the owner can then edit and delete", async () => {
    const owner = await newUser();
    const member = await newUser();

    const account = await authed("post", "/accounts", owner.token)
      .send({ type: "card", name: "Семейная карта", currency: "RUB", initialBalanceMinor: 0 })
      .expect(201);

    await joinViaInvite(account.body.id, owner.token, "member", member.token);

    const created = await authed("post", "/transactions", member.token)
      .send({
        type: "expense",
        accountId: account.body.id,
        amountMinor: 500,
        currency: "RUB",
        clientId: randomUUID(),
      })
      .expect(201);
    expect(created.body.createdByUserId).toBe(member.userId);

    // Owner shows up in the shared account's transaction list too.
    const listedForOwner = await authed("get", `/transactions?accountId=${account.body.id}`, owner.token).expect(200);
    expect(listedForOwner.body.map((t: { id: string }) => t.id)).toContain(created.body.id);

    // Owner can edit a transaction they didn't create.
    await authed("patch", `/transactions/${created.body.id}`, owner.token)
      .send({ amountMinor: 700 })
      .expect(200);

    // Owner can delete it too, and the deletion actually takes effect.
    await authed("delete", `/transactions/${created.body.id}`, owner.token).expect(200);
    const listedAfterDelete = await authed("get", `/transactions?accountId=${account.body.id}`, owner.token).expect(200);
    expect(listedAfterDelete.body.map((t: { id: string }) => t.id)).not.toContain(created.body.id);
  });

  it("a viewer can see a shared account but not add transactions to it", async () => {
    const owner = await newUser();
    const viewer = await newUser();

    const account = await authed("post", "/accounts", owner.token)
      .send({ type: "cash", name: "Общие наличные", currency: "RUB", initialBalanceMinor: 0 })
      .expect(201);

    await joinViaInvite(account.body.id, owner.token, "viewer", viewer.token);

    const accounts = await authed("get", "/accounts", viewer.token).expect(200);
    expect(accounts.body.find((a: { id: string }) => a.id === account.body.id)?.role).toBe("viewer");

    await authed("post", "/transactions", viewer.token)
      .send({
        type: "expense",
        accountId: account.body.id,
        amountMinor: 100,
        currency: "RUB",
        clientId: randomUUID(),
      })
      .expect(403);
  });

  it("one member cannot delete a transaction another member created", async () => {
    const owner = await newUser();
    const memberA = await newUser();
    const memberB = await newUser();

    const account = await authed("post", "/accounts", owner.token)
      .send({ type: "card", name: "Общая карта", currency: "RUB", initialBalanceMinor: 0 })
      .expect(201);

    await joinViaInvite(account.body.id, owner.token, "member", memberA.token);
    await joinViaInvite(account.body.id, owner.token, "member", memberB.token);

    const created = await authed("post", "/transactions", memberA.token)
      .send({
        type: "expense",
        accountId: account.body.id,
        amountMinor: 300,
        currency: "RUB",
        clientId: randomUUID(),
      })
      .expect(201);

    await authed("delete", `/transactions/${created.body.id}`, memberB.token).expect(403);

    // The creator can still delete their own transaction.
    await authed("delete", `/transactions/${created.body.id}`, memberA.token).expect(200);
  });

  it("a maxUses:1 invite cannot be accepted by a second person", async () => {
    const owner = await newUser();
    const first = await newUser();
    const second = await newUser();

    const account = await authed("post", "/accounts", owner.token)
      .send({ type: "bank", name: "Счёт", currency: "RUB", initialBalanceMinor: 0 })
      .expect(201);

    const invite = await authed("post", `/accounts/${account.body.id}/invites`, owner.token)
      .send({ role: "member", expiresInHours: null, maxUses: 1 })
      .expect(201);

    await authed("post", `/accounts/invites/${invite.body.token}/accept`, first.token).expect(201);
    await authed("post", `/accounts/invites/${invite.body.token}/accept`, second.token).expect(400);
  });

  it("cannot remove the last owner of an account", async () => {
    const owner = await newUser();
    const member = await newUser();

    const account = await authed("post", "/accounts", owner.token)
      .send({ type: "card", name: "Единственный владелец", currency: "RUB", initialBalanceMinor: 0 })
      .expect(201);
    await joinViaInvite(account.body.id, owner.token, "member", member.token);

    await authed("delete", `/accounts/${account.body.id}/members/${owner.userId}`, owner.token).expect(400);
  });
});
