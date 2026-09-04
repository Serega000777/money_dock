import { asMinorUnits, type Money } from "@money-dock/shared-types";

export class CurrencyMismatchError extends Error {
  constructor(a: Money, b: Money) {
    super(`Cannot combine ${a.currency} with ${b.currency}`);
    this.name = "CurrencyMismatchError";
  }
}

function assertSameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new CurrencyMismatchError(a, b);
  }
}

export function addMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return { amountMinor: asMinorUnits(a.amountMinor + b.amountMinor), currency: a.currency };
}

export function subtractMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return { amountMinor: asMinorUnits(a.amountMinor - b.amountMinor), currency: a.currency };
}

export function negateMoney(a: Money): Money {
  return { amountMinor: asMinorUnits(-a.amountMinor), currency: a.currency };
}

export function sumMoney(items: readonly Money[], currency: Money["currency"]): Money {
  return items.reduce(addMoney, { amountMinor: asMinorUnits(0), currency });
}

export function isZero(a: Money): boolean {
  return a.amountMinor === 0;
}

export function compareMoney(a: Money, b: Money): -1 | 0 | 1 {
  assertSameCurrency(a, b);
  if (a.amountMinor === b.amountMinor) return 0;
  return a.amountMinor < b.amountMinor ? -1 : 1;
}
