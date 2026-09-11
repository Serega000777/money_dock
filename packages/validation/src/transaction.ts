import { z } from "zod";

import { currencyCodeSchema } from "./money";

const splitSchema = z.object({
  categoryId: z.string().uuid(),
  amountMinor: z.number().int().positive(),
});

export const createTransactionSchema = z.object({
  type: z.enum(["expense", "income"]),
  accountId: z.string().uuid(),
  categoryId: z.string().uuid().optional(),
  amountMinor: z.number().int().positive(),
  currency: currencyCodeSchema,
  occurredAt: z.string().datetime().optional(),
  merchant: z.string().max(200).optional(),
  note: z.string().max(500).optional(),
  clientId: z.string().uuid(),
  splits: z.array(splitSchema).optional(),
});
export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;

/** `type` is editable here (an expense logged as income is a common slip) but stays
 * restricted to the two plain kinds — a transfer leg can't be turned into either without
 * orphaning its pair, which the service rejects outright. */
export const updateTransactionSchema = createTransactionSchema
  .omit({ clientId: true, splits: true })
  .partial();
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;

export const createTransferSchema = z.object({
  fromAccountId: z.string().uuid(),
  toAccountId: z.string().uuid(),
  amountMinor: z.number().int().positive(),
  currency: currencyCodeSchema,
  occurredAt: z.string().datetime().optional(),
  note: z.string().max(500).optional(),
  clientId: z.string().uuid(),
});
export type CreateTransferInput = z.infer<typeof createTransferSchema>;

export const listTransactionsQuerySchema = z.object({
  accountId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
export type ListTransactionsQuery = z.infer<typeof listTransactionsQuerySchema>;
