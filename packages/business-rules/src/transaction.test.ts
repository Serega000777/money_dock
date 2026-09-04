import type { Money } from "@money-dock/shared-types";
import { asMinorUnits } from "@money-dock/shared-types";
import { describe, expect, it } from "vitest";

import { assertSplitsMatchTotal, SplitSumMismatchError } from "./transaction";

const rub = (amountMinor: number): Money => ({
  amountMinor: asMinorUnits(amountMinor),
  currency: "RUB",
});

describe("assertSplitsMatchTotal", () => {
  it("passes when splits sum exactly to the total", () => {
    expect(() => assertSplitsMatchTotal(rub(1000), [700, 300])).not.toThrow();
  });

  it("throws when splits sum to less than the total", () => {
    expect(() => assertSplitsMatchTotal(rub(1000), [700, 299])).toThrow(SplitSumMismatchError);
  });

  it("throws when splits sum to more than the total", () => {
    expect(() => assertSplitsMatchTotal(rub(1000), [700, 301])).toThrow(SplitSumMismatchError);
  });

  it("passes for a single split equal to the total", () => {
    expect(() => assertSplitsMatchTotal(rub(500), [500])).not.toThrow();
  });

  it("treats an empty split list as summing to zero", () => {
    expect(() => assertSplitsMatchTotal(rub(0), [])).not.toThrow();
    expect(() => assertSplitsMatchTotal(rub(100), [])).toThrow(SplitSumMismatchError);
  });
});
