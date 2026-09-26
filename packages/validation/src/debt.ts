import { z } from "zod";

import { currencyCodeSchema } from "./money";

export const debtDirectionSchema = z.enum(["owed_to_me", "i_owe"]);

export const createDebtSchema = z.object({
  direction: debtDirectionSchema,
  counterpartyName: z.string().trim().min(1).max(100),
  amountMinor: z.number().int().positive(),
  currency: currencyCodeSchema.default("RUB"),
  note: z.string().trim().max(300).optional(),
  dueDate: z.string().datetime().optional(),
});
export type CreateDebtInput = z.infer<typeof createDebtSchema>;

export const updateDebtSchema = createDebtSchema.partial();
export type UpdateDebtInput = z.infer<typeof updateDebtSchema>;
