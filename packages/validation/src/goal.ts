import { z } from "zod";

import { currencyCodeSchema } from "./money";

export const createGoalSchema = z.object({
  name: z.string().trim().min(1).max(60),
  icon: z.string().trim().min(1).max(32).optional(),
  targetMinor: z.number().int().positive(),
  currency: currencyCodeSchema,
  /** YYYY-MM-DD; a calendar date, no time component. */
  deadline: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});
export type CreateGoalInput = z.infer<typeof createGoalSchema>;

/** Positive to put money aside, negative to take some back out. */
export const contributeGoalSchema = z.object({
  amountMinor: z
    .number()
    .int()
    .refine((value) => value !== 0, "amountMinor must be non-zero"),
});
export type ContributeGoalInput = z.infer<typeof contributeGoalSchema>;
