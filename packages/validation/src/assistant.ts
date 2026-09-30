import { z } from "zod";

export const createAssistantConversationSchema = z.object({
  title: z.string().trim().min(1).max(80).optional(),
});

export const sendAssistantMessageSchema = z.object({
  text: z.string().trim().min(1).max(2_000),
  inputType: z.enum(["text", "voice"]).default("text"),
});

export type CreateAssistantConversationInput = z.infer<typeof createAssistantConversationSchema>;
export type SendAssistantMessageInput = z.infer<typeof sendAssistantMessageSchema>;

