import { z } from "zod";

export const currencyCodeSchema = z.enum(["RUB", "USD", "EUR"]);

export const moneySchema = z.object({
  amountMinor: z.number().int(),
  currency: currencyCodeSchema,
});
