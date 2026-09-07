import { z } from "zod";

export const parseCommandSchema = z.object({
  text: z.string().trim().min(1).max(300),
  source: z.enum(["voice", "text"]).default("text"),
});

export type ParseCommandInput = z.infer<typeof parseCommandSchema>;
