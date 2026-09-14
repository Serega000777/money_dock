/**
 * One-time (or one-per-redeploy) setup: points Telegram at this server's webhook and
 * pins the shared secret it must echo back on every call — see
 * TelegramBotController.webhook. Run from apps/api with the same env the server itself
 * uses:
 *
 *   TELEGRAM_BOT_TOKEN=... TELEGRAM_WEBHOOK_SECRET=... PUBLIC_URL=https://amola-finance.ru \
 *     npx tsx src/scripts/set-telegram-webhook.ts
 *
 * Safe to re-run — setWebhook is idempotent, and Telegram simply replaces whatever
 * webhook was registered before.
 */
async function main(): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const publicUrl = process.env.PUBLIC_URL;

  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is required");
  if (!secret) throw new Error("TELEGRAM_WEBHOOK_SECRET is required");
  if (!publicUrl) throw new Error("PUBLIC_URL is required, e.g. https://amola-finance.ru");

  const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: `${publicUrl.replace(/\/$/, "")}/api/telegram/webhook`,
      secret_token: secret,
      allowed_updates: ["message"],
    }),
  });

  const body: unknown = await res.json();
  console.log(JSON.stringify(body, null, 2));
  if (!res.ok || (body as { ok?: boolean }).ok !== true) {
    throw new Error("setWebhook failed — see response above");
  }
  console.log("Webhook registered.");
}

void main();
