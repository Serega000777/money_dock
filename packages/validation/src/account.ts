import { z } from "zod";

import { currencyCodeSchema } from "./money";

export const accountTypeSchema = z.enum(["cash", "card", "bank"]);
export const bankSchema = z.enum(["sber", "alfa", "tinkoff", "vtb", "ozon", "bank_russia", "gazprombank"]);

export const createAccountSchema = z.object({
  type: accountTypeSchema,
  name: z.string().trim().min(1).max(100),
  currency: currencyCodeSchema,
  initialBalanceMinor: z.number().int().default(0),
  /** Card design only — see the `accounts.bank` schema comment. */
  bank: bankSchema.nullable().optional(),
  cardLast4: z.string().regex(/^\d{4}$/).nullable().optional(),
});
export type CreateAccountInput = z.infer<typeof createAccountSchema>;

export const updateAccountSchema = createAccountSchema.partial();
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
