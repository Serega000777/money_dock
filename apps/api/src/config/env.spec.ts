import { parseAdminTelegramIds, parseCorsOrigins } from "./env";

describe("parseAdminTelegramIds", () => {
  it("parses a comma-separated list into numbers", () => {
    expect(parseAdminTelegramIds("111, 222,333")).toEqual(new Set([111, 222, 333]));
  });

  it("ignores blanks and anything that isn't a plain integer", () => {
    expect(parseAdminTelegramIds("111,, 222,abc,4.5,-6")).toEqual(new Set([111, 222]));
  });

  it("is empty for an empty string", () => {
    expect(parseAdminTelegramIds("")).toEqual(new Set());
  });
});

describe("parseCorsOrigins", () => {
  it("splits a comma-separated list and trims whitespace", () => {
    expect(parseCorsOrigins("https://a.com, https://b.com")).toEqual([
      "https://a.com",
      "https://b.com",
    ]);
  });

  it("treats a bare * as wildcard even alongside other origins", () => {
    expect(parseCorsOrigins("https://a.com,*")).toBe("*");
  });
});
