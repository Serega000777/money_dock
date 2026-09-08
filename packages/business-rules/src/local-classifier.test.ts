import { describe, expect, it } from "vitest";

import { classifyByKeyword } from "./local-classifier";

describe("classifyByKeyword", () => {
  it("matches a generic restaurant keyword", () => {
    expect(classifyByKeyword("Кафе Уют")).toBe("restaurants");
  });

  it("matches case- and whitespace-insensitively", () => {
    expect(classifyByKeyword("  ТАКСИ  везёт")).toBe("transport");
  });

  it("matches an English keyword", () => {
    expect(classifyByKeyword("Downtown Pharmacy")).toBe("health");
  });

  it("returns null when nothing matches", () => {
    expect(classifyByKeyword("Иван Петров")).toBeNull();
  });
});
