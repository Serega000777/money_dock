import { z } from "zod";

const envSchema = z
  .object({
    /**
     * Defaults to `production` on purpose. This flag is the only thing standing between
     * the internet and `/auth/dev-login`, which hands out a session with no credentials —
     * so a deployment that forgets to set it must fail *closed* (dev-login off), never
     * open. Local development sets `NODE_ENV=development` explicitly in `.env`.
     */
    NODE_ENV: z.enum(["development", "test", "production"]).default("production"),
    PORT: z.coerce.number().int().positive().default(3000),
    DATABASE_URL: z.string().url(),
    /**
     * A single origin, a comma-separated list of them, or `*`. Required rather than
     * defaulted: silently falling back to `*` would let any website on the internet read
     * API responses with a stolen token.
     */
    CORS_ORIGIN: z.string().min(1),
    TELEGRAM_BOT_TOKEN: z.string().min(1),
    // Signs short-lived access JWTs. Refresh tokens are opaque random strings, hashed at
    // rest (see SessionsService) — they need no signing secret of their own.
    JWT_ACCESS_SECRET: z.string().min(32),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === "production" && parseCorsOrigins(env.CORS_ORIGIN) === "*") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["CORS_ORIGIN"],
        message:
          "CORS_ORIGIN must list explicit origins in production — '*' lets any site call the API with a stolen token.",
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

/**
 * `CORS_ORIGIN` is documented as a comma-separated list, but the raw string used to be
 * handed straight to `enableCors`, which compares it literally — so "a.com,b.com" matched
 * no origin at all and only the `*` case ever worked. This splits it properly.
 */
export function parseCorsOrigins(value: string): string[] | "*" {
  const origins = value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  return origins.includes("*") ? "*" : origins;
}

/** Fails fast on boot if required configuration is missing or malformed. */
export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    throw new Error(`Invalid environment configuration:\n${parsed.error.toString()}`);
  }
  return parsed.data;
}
