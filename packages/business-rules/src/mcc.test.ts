import { describe, expect, it } from "vitest";

import { mccToSystemCategory } from "./mcc";

describe("mccToSystemCategory", () => {
  it("maps a known grocery MCC", () => {
    expect(mccToSystemCategory("5411")).toBe("groceries");
  });

  it("maps a known restaurant MCC", () => {
    expect(mccToSystemCategory("5812")).toBe("restaurants");
  });

  it("trims whitespace", () => {
    expect(mccToSystemCategory(" 5541 ")).toBe("fuel");
  });

  it("returns null for an MCC outside the curated set", () => {
    expect(mccToSystemCategory("9999")).toBeNull();
  });
});
