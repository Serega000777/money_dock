import { z } from "zod";

import { currencyCodeSchema } from "./money";

export const createRecurringPaymentSchema = z.object({
  accountId: z.string().uuid(),
  categoryId: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(100),
  amountMinor: z.number().int().positive(),
  currency: currencyCodeSchema,
  dueDay: z.number().int().min(1).max(31).optional(),
  reminderDaysBefore: z.number().int().min(0).max(30).optional(),
});
export type CreateRecurringPaymentInput = z.infer<typeof createRecurringPaymentSchema>;
