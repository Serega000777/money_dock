import { z } from "zod";

export const planSchema = z.enum(["free", "pro", "pro_bank"]);

export const grantSubscriptionSchema = z.object({
  plan: planSchema,
  /** Days from now the plan lasts; omitted or 0 means perpetual (only sensible for
   * "free", which downgrading to already means "no expiry to track"). */
  days: z.number().int().positive().max(3650).optional(),
});
export type GrantSubscriptionInput = z.infer<typeof grantSubscriptionSchema>;

export const searchUsersSchema = z.object({
  query: z.string().trim().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type SearchUsersInput = z.infer<typeof searchUsersSchema>;
