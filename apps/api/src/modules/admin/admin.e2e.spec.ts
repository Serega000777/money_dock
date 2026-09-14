import { createHmac } from "node:crypto";

import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";

import { AppModule } from "../../app.module";
import { UsersService } from "../users/users.service";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "";
const runPrefix = Math.floor(Math.random() * 1_000_000);
let idCounter = 0;

function signInitData(userId: number): string {
  const params = new URLSearchParams({
    auth_date: String(Math.floor(Date.now() / 1000)),
    user: JSON.stringify({ id: userId, first_name: "AdminE2E", language_code: "ru" }),
  });
  const dataCheckString = [...params.entries()]
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join("\n");
  const secretKey = createHmac("sha256", "WebAppData").update(BOT_TOKEN).digest();
  params.set("hash", createHmac("sha256", secretKey).update(dataCheckString).digest("hex"));
  return params.toString();
}

describe("Admin panel (e2e)", () => {
  let app: INestApplication;
  let adminToken: string;
  let plainToken: string;
  let plainUserId: string;

  const authed = (method: "get" | "post", path: string, token: string) =>
    request(app.getHttpServer())[method](path).set("Authorization", `Bearer ${token}`);

  beforeAll(async () => {
    if (!BOT_TOKEN) throw new Error("TELEGRAM_BOT_TOKEN must be set to run this suite");
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();

    idCounter += 1;
    const adminLogin = await request(app.getHttpServer())
      .post("/auth/telegram")
      .send({ initData: signInitData(runPrefix * 1_000_000 + idCounter) })
      .expect(200);
    adminToken = adminLogin.body.accessToken;
    // Bypasses ADMIN_TELEGRAM_IDS/login-time promotion on purpose: that env var is read
    // once when AppModule's ConfigModule.forRoot() is evaluated, at the test file's
    // top-level import — before any beforeAll body runs — so there's no way for a single
    // test file to exercise it live. UsersService.promoteToAdmin is the exact same write
    // AuthService.promoteIfAdmin makes; calling it directly here tests AdminGuard and the
    // admin endpoints, which is the actual subject of this suite.
    await moduleRef.get(UsersService).promoteToAdmin(adminLogin.body.user.id);

    idCounter += 1;
    const plainLogin = await request(app.getHttpServer())
      .post("/auth/telegram")
      .send({ initData: signInitData(runPrefix * 1_000_000 + idCounter) })
      .expect(200);
    plainToken = plainLogin.body.accessToken;
    plainUserId = plainLogin.body.user.id;
    expect(plainLogin.body.user.role).toBe("user");
  });

  afterAll(async () => {
    await app.close();
  });

  it("refuses a non-admin and an unauthenticated caller", async () => {
    await authed("get", "/admin/stats", plainToken).expect(403);
    await request(app.getHttpServer()).get("/admin/stats").expect(401);
  });

  it("lets the admin read stats and find the other user by name", async () => {
    const stats = await authed("get", "/admin/stats", adminToken).expect(200);
    expect(stats.body.totalUsers).toBeGreaterThanOrEqual(2);
    expect(typeof stats.body.activeToday).toBe("number");
    expect(typeof stats.body.totalAccounts).toBe("number");

    const found = await authed("get", "/admin/users?query=AdminE2E&limit=50", adminToken).expect(200);
    expect(found.body.map((u: { id: string }) => u.id)).toContain(plainUserId);
    const match = found.body.find((u: { id: string }) => u.id === plainUserId);
    expect(match.plan).toBe("free");
  });

  it("gifts a subscription that the entitlements endpoint then reflects", async () => {
    await authed("post", `/admin/users/${plainUserId}/subscription`, adminToken)
      .send({ plan: "pro", days: 30 })
      .expect(204);

    const entitlements = await authed("get", "/entitlements", plainToken).expect(200);
    expect(entitlements.body.plan).toBe("pro");
    expect(entitlements.body.limits.voice).toBe(-1);
  });

  it("a plain user cannot gift themselves a subscription", async () => {
    await authed("post", `/admin/users/${plainUserId}/subscription`, plainToken)
      .send({ plan: "pro", days: 30 })
      .expect(403);
  });
});
