import { z } from "zod";

export const createAssistantConversationSchema = z.object({
  title: z.string().trim().min(1).max(80).optional(),
});

export const sendAssistantMessageSchema = z.object({
  text: z.string().trim().min(1).max(2_000),
  inputType: z.enum(["text", "voice"]).default("text"),
});

export const updateAssistantActionSchema = z.object({
  amountMinor: z.number().int().positive().optional(),
  type: z.enum(["expense", "income"]).optional(),
  categoryId: z.string().uuid().nullable().optional(),
  accountId: z.string().uuid().optional(),
  occurredAt: z.string().datetime().optional(),
  note: z.string().trim().max(500).optional(),
}).refine((value) => Object.keys(value).length > 0, "Укажите хотя бы одно изменение");

export type CreateAssistantConversationInput = z.infer<typeof createAssistantConversationSchema>;
export type SendAssistantMessageInput = z.infer<typeof sendAssistantMessageSchema>;
export type UpdateAssistantActionInput = z.infer<typeof updateAssistantActionSchema>;
