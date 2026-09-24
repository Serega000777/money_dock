import { z } from "zod";

export const createShortcutCredentialSchema = z.object({ name: z.string().trim().min(1).max(80).default("iPhone") });
export const shortcutCaptureSchema = z.object({
  input: z.string().trim().min(1).max(300),
  walletId: z.string().uuid().optional(),
  mode: z.enum(["text", "voice"]).default("text"),
  // A free label, not a real platform check — nothing downstream branches on it, it's
  // only ever logged. Kept loose (not a literal union) so any HTTP-automation app can
  // self-identify without the request being rejected for using the "wrong" name.
  source: z.string().trim().min(1).max(40).default("ios_shortcut"),
  // Optional: building a real UUID is trivial in Apple Shortcuts (a dedicated action) but
  // not every generic Android "HTTP request" app has an equivalent — ShortcutsService
  // generates one server-side when this is left out, at the cost of losing retry
  // idempotency for whichever client omits it.
  clientRequestId: z.string().uuid().optional(),
});
export type ShortcutCaptureInput = z.infer<typeof shortcutCaptureSchema>;
