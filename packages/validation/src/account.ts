import { z } from "zod";

import { currencyCodeSchema } from "./money";

export const accountTypeSchema = z.enum(["cash", "card", "bank"]);

export const createAccountSchema = z.object({
  type: accountTypeSchema,
  name: z.string().trim().min(1).max(100),
  currency: currencyCodeSchema,
  initialBalanceMinor: z.number().int().default(0),
});
export type CreateAccountInput = z.infer<typeof createAccountSchema>;

export const updateAccountSchema = createAccountSchema.partial();
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
