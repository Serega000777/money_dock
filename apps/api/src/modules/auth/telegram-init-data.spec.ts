import { createHmac } from "node:crypto";

import { verifyTelegramInitData } from "./telegram-init-data";

const BOT_TOKEN = "123456:test-bot-token";

function sign(fields: Record<string, string>): string {
  const params = new URLSearchParams(fields);
  const dataCheckString = [...params.entries()]
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join("\n");
  const secretKey = createHmac("sha256", "WebAppData").update(BOT_TOKEN).digest();
  const hash = createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
  params.set("hash", hash);
  return params.toString();
}

function validInitData(overrides: Partial<{ authDate: number; userId: number }> = {}): string {
  const authDate = overrides.authDate ?? Math.floor(Date.now() / 1000);
  const user = JSON.stringify({
    id: overrides.userId ?? 42,
    first_name: "Ada",
    language_code: "ru",
  });
  return sign({ auth_date: String(authDate), user, query_id: "AAEC" });
}

describe("verifyTelegramInitData", () => {
  it("accepts a correctly signed, fresh initData", () => {
    const result = verifyTelegramInitData(validInitData({ userId: 42 }), BOT_TOKEN);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.user.id).toBe(42);
  });

  it("rejects a missing hash", () => {
    const params = new URLSearchParams(validInitData());
    params.delete("hash");
    expect(verifyTelegramInitData(params.toString(), BOT_TOKEN)).toEqual({
      ok: false,
      reason: "missing_hash",
    });
  });

  it("rejects a tampered field (signature no longer matches)", () => {
    const params = new URLSearchParams(validInitData());
    params.set("auth_date", String(Math.floor(Date.now() / 1000) - 5));
    expect(verifyTelegramInitData(params.toString(), BOT_TOKEN)).toEqual({
      ok: false,
      reason: "bad_signature",
    });
  });

  it("rejects a signature produced with the wrong bot token", () => {
    const params = new URLSearchParams(validInitData());
    const wrongHash = createHmac("sha256", "not-the-bot-token").update("x").digest("hex");
    params.set("hash", wrongHash);
    expect(verifyTelegramInitData(params.toString(), BOT_TOKEN).ok).toBe(false);
  });

  it("rejects stale auth_date beyond the max age", () => {
    const staleDate = Math.floor(Date.now() / 1000) - 25 * 60 * 60; // 25h old
    expect(verifyTelegramInitData(validInitData({ authDate: staleDate }), BOT_TOKEN)).toEqual({
      ok: false,
      reason: "stale",
    });
  });

  it("rejects an auth_date far in the future", () => {
    const futureDate = Math.floor(Date.now() / 1000) + 3600;
    expect(verifyTelegramInitData(validInitData({ authDate: futureDate }), BOT_TOKEN)).toEqual({
      ok: false,
      reason: "stale",
    });
  });

  it("rejects malformed user JSON even with a valid signature", () => {
    const initData = sign({ auth_date: String(Math.floor(Date.now() / 1000)), user: "{not json" });
    expect(verifyTelegramInitData(initData, BOT_TOKEN)).toEqual({ ok: false, reason: "malformed" });
  });

  it("rejects completely empty input", () => {
    expect(verifyTelegramInitData("", BOT_TOKEN)).toEqual({ ok: false, reason: "missing_hash" });
  });
});
