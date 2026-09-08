import { z } from "zod";

export const parseCommandSchema = z.object({
  text: z.string().trim().min(1).max(300),
  source: z.enum(["voice", "text"]).default("text"),
});

export type ParseCommandInput = z.infer<typeof parseCommandSchema>;

/**
 * Hands-free capture (Siri shortcut, home-screen widget). Unlike `parse`, this one writes
 * — so it carries a clientId for idempotency, and everything it saves lands unconfirmed.
 */
export const captureCommandSchema = z.object({
  text: z.string().trim().min(1).max(300),
  source: z.enum(["voice", "text"]).default("voice"),
  clientId: z.string().uuid(),
});

export type CaptureCommandInput = z.infer<typeof captureCommandSchema>;
