import { z } from "zod";

export const createShortcutCredentialSchema = z.object({
  name: z.string().trim().min(1).max(80).default("iPhone"),
});
export const shortcutCaptureSchema = z
  .object({
    // For mode "photo", this carries base64 image data instead of text — Shortcuts-style
    // integrations can't do a real multipart upload, but can base64-encode a photo into a
    // JSON string field. ~10MB of raw image data, base64-inflated, plus headroom.
    input: z.string().trim().min(1).max(14_000_000),
    walletId: z.string().uuid().optional(),
    mode: z.enum(["text", "voice", "photo"]).default("text"),
    imageMimeType: z.string().trim().min(1).max(40).default("image/jpeg"),
    // A free label, not a real platform check — nothing downstream branches on it, it's
    // only ever logged. Kept loose (not a literal union) so any HTTP-automation app can
    // self-identify without the request being rejected for using the "wrong" name.
    source: z.string().trim().min(1).max(40).default("ios_shortcut"),
    // Optional: building a real UUID is trivial in Apple Shortcuts (a dedicated action) but
    // not every generic Android "HTTP request" app has an equivalent — ShortcutsService
    // generates one server-side when this is left out, at the cost of losing retry
    // idempotency for whichever client omits it.
    clientRequestId: z.string().uuid().optional(),
  })
  .refine((value) => value.mode === "photo" || value.input.length <= 300, {
    message: "input must be at most 300 characters for text/voice mode",
    path: ["input"],
  });
export type ShortcutCaptureInput = z.infer<typeof shortcutCaptureSchema>;
