import { z } from "zod";

export const telegramAuthSchema = z.object({
  initData: z.string().min(1),
});
export type TelegramAuthInput = z.infer<typeof telegramAuthSchema>;

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});
export type RefreshInput = z.infer<typeof refreshSchema>;
