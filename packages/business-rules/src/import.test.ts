import { describe, expect, it } from "vitest";

import {
  classifyDedup,
  detectColumns,
  levenshtein,
  merchantSimilarity,
  normalizeMerchant,
  parseAmountToMinor,
  parseRowDate,
  RowParseError,
} from "./import";

describe("normalizeMerchant", () => {
  it("lowercases, trims and collapses whitespace", () => {
    expect(normalizeMerchant("  АЗС   ATAN  ")).toBe("азс atan");
  });
});

describe("levenshtein / merchantSimilarity", () => {
  it("scores identical strings as 1 regardless of case and spacing", () => {
    expect(levenshtein("abc", "abc")).toBe(0);
    expect(merchantSimilarity("OZON", "  ozon ")).toBe(1);
  });

  it("scores near-identical merchant names high", () => {
    expect(merchantSimilarity("АЗС ATAN 42", "АЗС ATAN 42 ")).toBeGreaterThan(0.95);
    expect(merchantSimilarity("Пятёрочка", "Пятерочка")).toBeGreaterThan(0.85);
  });

  it("scores unrelated merchants low", () => {
    expect(merchantSimilarity("OZON", "Аэрофлот")).toBeLessThan(0.3);
  });

  it("treats two empty strings as identical rather than dividing by zero", () => {
    expect(merchantSimilarity("", "")).toBe(1);
  });
});

describe("parseAmountToMinor", () => {
  it("parses RU-style amounts with comma decimals and thin spaces", () => {
    expect(parseAmountToMinor("1 234,56")).toBe(123_456);
    expect(parseAmountToMinor("1 234,56")).toBe(123_456);
  });

  it("parses plain and negative amounts", () => {
    expect(parseAmountToMinor("1234.56")).toBe(123_456);
    expect(parseAmountToMinor("-500")).toBe(-50_000);
  });

  it("treats parenthesised amounts as negative (accounting style)", () => {
    expect(parseAmountToMinor("(500)")).toBe(-50_000);
  });

  it("strips currency symbols", () => {
    expect(parseAmountToMinor("840 ₽")).toBe(84_000);
  });

  it("rounds to whole minor units — never leaves a float", () => {
    expect(Number.isInteger(parseAmountToMinor("10.005"))).toBe(true);
  });

  it("throws a typed error on garbage instead of silently producing NaN", () => {
    expect(() => parseAmountToMinor("не сумма")).toThrow(RowParseError);
  });
});

describe("parseRowDate", () => {
  it("parses ISO dates", () => {
    expect(parseRowDate("2026-03-15").toISOString()).toBe("2026-03-15T00:00:00.000Z");
  });

  it("parses RU dot-separated dates", () => {
    expect(parseRowDate("15.03.2026").toISOString()).toBe("2026-03-15T00:00:00.000Z");
    expect(parseRowDate("5.3.2026").toISOString()).toBe("2026-03-05T00:00:00.000Z");
  });

  it("parses slash-separated day-first dates", () => {
    expect(parseRowDate("15/03/2026").toISOString()).toBe("2026-03-15T00:00:00.000Z");
  });

  it("throws on an unparseable date", () => {
    expect(() => parseRowDate("вчера")).toThrow(RowParseError);
  });
});

describe("detectColumns", () => {
  it("maps a Russian bank export header", () => {
    expect(detectColumns(["Дата операции", "Сумма операции", "Назначение платежа"])).toEqual({
      date: 0,
      amount: 1,
      merchant: 2,
    });
  });

  it("maps an English header in a different column order", () => {
    expect(detectColumns(["Description", "Amount", "Date"])).toEqual({
      date: 2,
      amount: 1,
      merchant: 0,
    });
  });

  it("allows a missing merchant column", () => {
    expect(detectColumns(["Дата", "Сумма"])).toEqual({ date: 0, amount: 1, merchant: null });
  });

  it("fails loudly when date or amount is missing", () => {
    expect(() => detectColumns(["Описание", "Сумма"])).toThrow(RowParseError);
    expect(() => detectColumns(["Дата", "Описание"])).toThrow(RowParseError);
  });
});

describe("classifyDedup", () => {
  const existing = [
    { id: "tx-1", amountMinor: 345_000, merchant: "АЗС ATAN" },
    { id: "tx-2", amountMinor: 698_000, merchant: "OZON" },
  ];

  it("flags an exact amount + merchant match as a duplicate", () => {
    const verdict = classifyDedup({ amountMinor: 345_000, merchant: "азс atan" }, existing);
    expect(verdict.tier).toBe("duplicate");
    expect(verdict.matchId).toBe("tx-1");
  });

  it("sends a same-amount but differently-named merchant to review", () => {
    const verdict = classifyDedup({ amountMinor: 698_000, merchant: "OZON.RU" }, existing);
    expect(verdict.tier).toBe("review");
    expect(verdict.matchId).toBe("tx-2");
  });

  it("treats a different amount as a new transaction even with the same merchant", () => {
    expect(classifyDedup({ amountMinor: 999, merchant: "OZON" }, existing).tier).toBe("new");
  });

  it("treats everything as new when there is no history", () => {
    expect(classifyDedup({ amountMinor: 100, merchant: "OZON" }, []).tier).toBe("new");
  });

  it("does not match a same-amount row with an unrelated merchant", () => {
    expect(classifyDedup({ amountMinor: 698_000, merchant: "Аэрофлот" }, existing).tier).toBe(
      "new",
    );
  });
});
