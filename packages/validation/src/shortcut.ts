import { z } from "zod";

export const createShortcutCredentialSchema = z.object({ name: z.string().trim().min(1).max(80).default("iPhone") });
export const shortcutCaptureSchema = z.object({
  input: z.string().trim().min(1).max(300),
  walletId: z.string().uuid().optional(),
  mode: z.enum(["text", "voice"]).default("text"),
  source: z.literal("ios_shortcut").default("ios_shortcut"),
  clientRequestId: z.string().uuid(),
});
export type ShortcutCaptureInput = z.infer<typeof shortcutCaptureSchema>;
