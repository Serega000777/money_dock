import { describe, expect, it } from "vitest";

import {
  averageDailySpend,
  medianDailySpend,
  monthEndForecast,
  percentChange,
  safeToSpendPerDay,
} from "./analytics";

describe("percentChange", () => {
  it("computes a normal increase and decrease", () => {
    expect(percentChange(1000, 1200)).toBe(20);
    expect(percentChange(1000, 800)).toBe(-20);
  });

  it("handles previous=0 with a nonzero current as undefined growth (null)", () => {
    expect(percentChange(0, 500)).toBeNull();
  });

  it("treats 0 -> 0 as no change, not undefined", () => {
    expect(percentChange(0, 0)).toBe(0);
  });

  it("nets a refund against an expense within the same period (previous period had the expense, this one has only the refund as income-like negative expense)", () => {
    // Modeled as: previous period spent 1000, this period spent 1000 then got 1000 back
    // (refund recorded as income), netting to an effective 0 expense for the comparison.
    const previousExpense = 1000;
    const currentNetExpense = 1000 - 1000;
    expect(percentChange(previousExpense, currentNetExpense)).toBe(-100);
  });
});

describe("averageDailySpend", () => {
  it("divides by elapsed days", () => {
    expect(averageDailySpend(3000, 3)).toBe(1000);
  });

  it("returns 0 for an empty (zero-elapsed-day) period rather than dividing by zero", () => {
    expect(averageDailySpend(3000, 0)).toBe(0);
  });
});

describe("medianDailySpend", () => {
  it("returns the middle value for an odd-length list", () => {
    expect(medianDailySpend([100, 300, 200])).toBe(200);
  });

  it("averages the two middle values for an even-length list", () => {
    expect(medianDailySpend([100, 200, 300, 400])).toBe(250);
  });

  it("returns 0 for an empty period", () => {
    expect(medianDailySpend([])).toBe(0);
  });
});

describe("safeToSpendPerDay", () => {
  it("splits the balance evenly across remaining days", () => {
    expect(safeToSpendPerDay(10_000, 4)).toBe(2_500);
  });

  it("never goes negative when the balance is already negative", () => {
    expect(safeToSpendPerDay(-5_000, 5)).toBe(0);
  });

  it("returns the (clamped) balance itself when no days remain", () => {
    expect(safeToSpendPerDay(1_000, 0)).toBe(1_000);
    expect(safeToSpendPerDay(-1_000, 0)).toBe(0);
  });
});

describe("monthEndForecast", () => {
  it("projects balance forward at the current average spend rate", () => {
    expect(monthEndForecast(10_000, 500, 4)).toBe(8_000);
  });

  it("handles zero average spend (forecast equals current balance)", () => {
    expect(monthEndForecast(10_000, 0, 10)).toBe(10_000);
  });

  it("can project a shortfall (negative forecast) — that's the point of the warning", () => {
    expect(monthEndForecast(1_000, 500, 10)).toBe(-4_000);
  });
});
