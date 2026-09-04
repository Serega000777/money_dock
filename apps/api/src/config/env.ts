import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().url(),
  CORS_ORIGIN: z.string().default("*"),
  TELEGRAM_BOT_TOKEN: z.string().min(1),
  // Signs short-lived access JWTs. Refresh tokens are opaque random strings, hashed at
  // rest (see SessionsService) — they need no signing secret of their own.
  JWT_ACCESS_SECRET: z.string().min(32),
});

export type Env = z.infer<typeof envSchema>;

/** Fails fast on boot if required configuration is missing or malformed. */
export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    throw new Error(`Invalid environment configuration:\n${parsed.error.toString()}`);
  }
  return parsed.data;
}
