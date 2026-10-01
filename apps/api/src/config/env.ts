import { z } from "zod";

const optionalSecret = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().min(1).optional(),
);

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
    // Validates the `X-Telegram-Bot-Api-Secret-Token` header on incoming webhook calls
    // (set via setWebhook's secret_token) — without this, anyone who finds the webhook
    // URL could post fake Telegram updates. Optional: the bot's /start flow (welcome
    // message, phone capture) simply doesn't run until both this and a registered
    // webhook exist; nothing else in the app depends on it.
    TELEGRAM_WEBHOOK_SECRET: z.string().min(16).optional(),
    // Comma-separated Telegram numeric user ids (from @userinfobot or similar) promoted
    // to the `admin` role on their next login — see AuthService.loginWithTelegram. Empty
    // by default: a deployment with no admin configured just has no admin panel access,
    // never an open one.
    ADMIN_TELEGRAM_IDS: z.string().default(""),
    // A single Telegram numeric user id (from @userinfobot) whose cabinet shows the admin
    // panel entry point. Deliberately separate from ADMIN_TELEGRAM_IDS: that list grants
    // the `admin` role (API access) and may grow to cover support staff later, while the
    // owner-only dashboard link should still follow just one person even then. Unset =
    // nobody sees the link, regardless of role.
    OWNER_TELEGRAM_ID: z.string().optional(),
    // Audience of Sign in with Apple identity tokens. For the native app this is the
    // bundle identifier; keeping it configurable also supports a future web Service ID.
    APPLE_CLIENT_ID: z.string().min(1).default("app.amola.finance"),
    // A plain public HTTPS image URL sent with the /start welcome message. Optional on
    // purpose: there is no house banner asset to ship a default for, and inventing a
    // placeholder would just be something to notice and replace later. Unset = a
    // text-only welcome, same message otherwise. The bot's own profile photo (set once,
    // in @BotFather) is what shows everywhere else — chat list, profile, Mini App header.
    TELEGRAM_BANNER_URL: z.string().url().optional(),
    // Signs short-lived access JWTs. Refresh tokens are opaque random strings, hashed at
    // rest (see SessionsService) — they need no signing secret of their own.
    JWT_ACCESS_SECRET: z.string().min(32),
    // Active speech pipeline. OpenAI/Gemini variables below are retained only for
    // rollback compatibility; the production runtime uses Yandex SpeechKit.
    SPEECH_PROVIDER: z.enum(["yandex", "disabled"]).default("yandex"),
    YANDEX_SPEECHKIT_API_KEY: optionalSecret,
    YANDEX_FOLDER_ID: optionalSecret,
    YANDEX_SPEECHKIT_MODEL: z.string().min(1).default("general"),
    ASSISTANT_ENABLED: z
      .enum(["true", "false"])
      .default("true")
      .transform((value) => value === "true"),
    AI_PROVIDER: z.enum(["deepseek"]).default("deepseek"),
    AI_FALLBACK_PROVIDER: z.enum(["gigachat", "disabled"]).default("gigachat"),
    DEEPSEEK_API_KEY: optionalSecret,
    DEEPSEEK_MODEL: z.string().min(1).default("deepseek-flash"),
    DEEPSEEK_BASE_URL: z.string().url().default("https://api.deepseek.com"),
    DEEPSEEK_AUTH_SCHEME: z.enum(["bearer", "api-key"]).default("bearer"),
    // Receipt photo capture (Shortcuts/widget "photo" mode) needs a multimodal model —
    // confirmed against Yandex AI Studio that the plain DEEPSEEK_MODEL text model does
    // not accept image_url content, but deepseek-v4.1-flash does. Reuses
    // DEEPSEEK_API_KEY/BASE_URL/AUTH_SCHEME; unset = receipt scan reports unavailable
    // rather than guessing against a model that can't see the image.
    DEEPSEEK_VISION_MODEL: z.string().min(1).optional(),
    GIGACHAT_AUTHORIZATION_KEY: optionalSecret,
    GIGACHAT_SCOPE: z
      .enum(["GIGACHAT_API_PERS", "GIGACHAT_API_B2B", "GIGACHAT_API_CORP"])
      .default("GIGACHAT_API_PERS"),
    GIGACHAT_MODEL: z.string().min(1).default("GigaChat-2"),
    // Powers server-side speech-to-text (TranscriptionService) for clients with no
    // client-side recognizer — notably every iOS browser, since WebKit has never shipped
    // the Web Speech API's SpeechRecognition interface. Optional: without it, recording
    // audio on an unsupported client fails with a clear "unavailable" error instead of
    // the whole app refusing to boot.
    GEMINI_API_KEY: optionalSecret,
    // General multimodal generateContent is available to ordinary Gemini API keys and
    // accepts short inline audio. The dedicated transcription model/Interactions API is
    // access-restricted for some projects and previously made iPhone voice input fail
    // with 403 even though the same key could use regular Gemini models.
    GEMINI_MODEL: z.string().min(1).default("gemini-3.8-flash"),
    // Preferred production STT provider. `gpt-transcribe` accepts mp4/m4a/webm/wav and
    // is reached through the dedicated multipart transcription endpoint. Gemini stays
    // available as a fallback for installations that already configured it.
    OPENAI_API_KEY: optionalSecret,
    OPENAI_TRANSCRIPTION_MODEL: z.string().min(1).default("gpt-transcribe"),
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

/** Parses `ADMIN_TELEGRAM_IDS` into a set of numeric Telegram user ids, ignoring blanks
 * and anything that isn't a plain integer (a typo here should never silently promote the
 * wrong account — it just won't match anyone). */
export function parseAdminTelegramIds(value: string): Set<number> {
  return new Set(
    value
      .split(",")
      .map((id) => id.trim())
      .filter((id) => /^\d+$/.test(id))
      .map(Number),
  );
}

/** Fails fast on boot if required configuration is missing or malformed. */
export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    throw new Error(`Invalid environment configuration:\n${parsed.error.toString()}`);
  }
  return parsed.data;
}
