/**
 * Money is always an integer count of minor currency units (e.g. kopecks, cents).
 * Floats are never used for money anywhere in this codebase.
 */
export type MinorUnits = number & { readonly __brand: "MinorUnits" };

export type CurrencyCode = "RUB" | "USD" | "EUR";

export interface Money {
  readonly amountMinor: MinorUnits;
  readonly currency: CurrencyCode;
}

export function asMinorUnits(value: number): MinorUnits {
  if (!Number.isInteger(value)) {
    throw new TypeError(`Money amount must be an integer minor-units value, got ${value}`);
  }
  return value as MinorUnits;
}
