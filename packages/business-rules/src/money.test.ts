import { asMinorUnits, type Money } from "@money-dock/shared-types";
import { describe, expect, it } from "vitest";

import {
  addMoney,
  compareMoney,
  CurrencyMismatchError,
  isZero,
  negateMoney,
  subtractMoney,
  sumMoney,
} from "./money";

const rub = (amountMinor: number): Money => ({
  amountMinor: asMinorUnits(amountMinor),
  currency: "RUB",
});

describe("money arithmetic", () => {
  it("adds two amounts of the same currency", () => {
    expect(addMoney(rub(100), rub(50))).toEqual(rub(150));
  });

  it("subtracts amounts and allows negative results", () => {
    expect(subtractMoney(rub(50), rub(100))).toEqual(rub(-50));
  });

  it("negates an amount", () => {
    expect(negateMoney(rub(100))).toEqual(rub(-100));
  });

  it("sums a list, defaulting to zero for an empty list", () => {
    expect(sumMoney([], "RUB")).toEqual(rub(0));
    expect(sumMoney([rub(100), rub(200), rub(-50)], "RUB")).toEqual(rub(250));
  });

  it("treats zero as zero regardless of sign", () => {
    expect(isZero(rub(0))).toBe(true);
    expect(isZero(rub(1))).toBe(false);
  });

  it("compares amounts", () => {
    expect(compareMoney(rub(100), rub(50))).toBe(1);
    expect(compareMoney(rub(50), rub(100))).toBe(-1);
    expect(compareMoney(rub(50), rub(50))).toBe(0);
  });

  it("rejects mixing currencies", () => {
    const usd: Money = { amountMinor: asMinorUnits(100), currency: "USD" };
    expect(() => addMoney(rub(100), usd)).toThrow(CurrencyMismatchError);
  });
});
