import { createHmac, timingSafeEqual } from "node:crypto";

export interface TelegramInitDataUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

export type TelegramInitDataResult =
  | { ok: true; user: TelegramInitDataUser; authDate: Date }
  | { ok: false; reason: "missing_hash" | "bad_signature" | "stale" | "malformed" };

/**
 * Verifies Telegram Mini App `initData` per the official algorithm:
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 *
 * secret_key = HMAC_SHA256(<bot_token>, "WebAppData")
 * hash       = HMAC_SHA256(<data_check_string>, secret_key)
 * where data_check_string is every field except `hash`, "key=value" sorted by key, joined by "\n".
 */
export function verifyTelegramInitData(
  initData: string,
  botToken: string,
  maxAgeSeconds = 24 * 60 * 60,
): TelegramInitDataResult {
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(initData);
  } catch {
    return { ok: false, reason: "malformed" };
  }

  const hash = params.get("hash");
  if (!hash) return { ok: false, reason: "missing_hash" };

  const pairs: string[] = [];
  for (const [key, value] of params.entries()) {
    if (key === "hash") continue;
    pairs.push(`${key}=${value}`);
  }
  pairs.sort();
  const dataCheckString = pairs.join("\n");

  const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest();
  const computedHash = createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  const a = Buffer.from(computedHash, "hex");
  const b = Buffer.from(hash, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: "bad_signature" };
  }

  const authDateRaw = params.get("auth_date");
  const userRaw = params.get("user");
  if (!authDateRaw || !userRaw) return { ok: false, reason: "malformed" };

  const authDateSeconds = Number(authDateRaw);
  if (!Number.isFinite(authDateSeconds)) return { ok: false, reason: "malformed" };
  const authDate = new Date(authDateSeconds * 1000);

  const ageSeconds = Date.now() / 1000 - authDateSeconds;
  if (ageSeconds > maxAgeSeconds || ageSeconds < -60) {
    return { ok: false, reason: "stale" };
  }

  try {
    const user = JSON.parse(userRaw) as TelegramInitDataUser;
    if (typeof user.id !== "number" || typeof user.first_name !== "string") {
      return { ok: false, reason: "malformed" };
    }
    return { ok: true, user, authDate };
  } catch {
    return { ok: false, reason: "malformed" };
  }
}
