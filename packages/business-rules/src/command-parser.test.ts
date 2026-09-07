import { describe, expect, it } from "vitest";

import { CommandParseError, parseCommand } from "./command-parser";

describe("parseCommand — amounts", () => {
  it("reads plain digits", () => {
    expect(parseCommand("потратил 840 рублей").amountMinor).toBe(84_000);
  });

  it("reads digits with a decimal part", () => {
    expect(parseCommand("потратил 1500,50 рублей").amountMinor).toBe(150_050);
  });

  it("reads digits split by spaces", () => {
    expect(parseCommand("потратил 25 000 рублей").amountMinor).toBe(2_500_000);
  });

  it("multiplies by a thousand when the word follows the digits", () => {
    expect(parseCommand("добавь доход 50 тысяч").amountMinor).toBe(5_000_000);
  });

  it("reads spelled-out numbers", () => {
    expect(parseCommand("потратил две тысячи пятьсот на бензин").amountMinor).toBe(250_000);
    expect(parseCommand("потратил сто рублей").amountMinor).toBe(10_000);
  });

  it("throws when there is no amount at all", () => {
    expect(() => parseCommand("купил что-то в магазине")).toThrow(CommandParseError);
  });

  it("throws on empty input", () => {
    expect(() => parseCommand("   ")).toThrow(CommandParseError);
  });
});

describe("parseCommand — type", () => {
  it("treats spending words as an expense", () => {
    expect(parseCommand("потратил 500 рублей").type).toBe("expense");
    expect(parseCommand("купил кофе за 300").type).toBe("expense");
  });

  it("treats income words as income", () => {
    expect(parseCommand("добавь доход 50 тысяч").type).toBe("income");
    expect(parseCommand("пришла зарплата 120000").type).toBe("income");
  });

  it("defaults to expense when nothing indicates direction", () => {
    expect(parseCommand("840 в кафе").type).toBe("expense");
  });

  it("prefers expense when both signals appear", () => {
    expect(parseCommand("потратил 500 из зарплаты").type).toBe("expense");
  });
});

describe("parseCommand — category", () => {
  it.each([
    ["840 рублей в кафе", "restaurants"],
    ["2500 на бензин", "fuel"],
    ["1200 на такси", "transport"],
    ["3000 в пятёрочке", "groceries"],
    ["990 за интернет", "communication"],
    ["5000 в аптеке", "health"],
    ["добавь доход 50 тысяч зарплата", "salary"],
  ])("maps %s to %s", (phrase, expected) => {
    expect(parseCommand(phrase).categoryCode).toBe(expected);
  });

  it("leaves the category empty when nothing matches", () => {
    expect(parseCommand("потратил 700 рублей").categoryCode).toBeNull();
  });
});

describe("parseCommand — account and date", () => {
  it("detects a cash account", () => {
    expect(parseCommand("вчера потратил 840 в кафе наличными").accountType).toBe("cash");
  });

  it("detects a card account", () => {
    expect(parseCommand("потратил 840 картой").accountType).toBe("card");
  });

  it("reads relative dates", () => {
    expect(parseCommand("вчера потратил 840").daysAgo).toBe(1);
    expect(parseCommand("позавчера потратил 840").daysAgo).toBe(2);
    expect(parseCommand("сегодня потратил 840").daysAgo).toBe(0);
    expect(parseCommand("потратил 840 три дня назад").daysAgo).toBe(0); // spelled-out days aren't read
    expect(parseCommand("потратил 840 5 дней назад").daysAgo).toBe(5);
  });

  it("defaults to today when no date is mentioned", () => {
    expect(parseCommand("потратил 840 в кафе").daysAgo).toBe(0);
  });
});

describe("parseCommand — confidence", () => {
  it("scores a fully specified command high", () => {
    const result = parseCommand("вчера потратил 840 рублей в кафе с наличных");
    expect(result.confidence).toBeGreaterThan(0.85);
    expect(result.matched).toEqual(
      expect.arrayContaining(["amount", "type", "category", "account", "date"]),
    );
  });

  it("scores an amount-only command low enough to require confirmation", () => {
    expect(parseCommand("840").confidence).toBeLessThan(0.6);
  });

  it("never exceeds its ceiling", () => {
    expect(
      parseCommand("вчера потратил 840 рублей в кафе с наличных").confidence,
    ).toBeLessThanOrEqual(0.98);
  });
});

describe("parseCommand — the examples from the product spec", () => {
  it('"Добавь 2500 рублей в расходы на топливо"', () => {
    const result = parseCommand("Добавь 2500 рублей в расходы на топливо");
    expect(result).toMatchObject({ type: "expense", amountMinor: 250_000, categoryCode: "fuel" });
  });

  it('"Вчера потратил 840 рублей в кафе с наличных"', () => {
    const result = parseCommand("Вчера потратил 840 рублей в кафе с наличных");
    expect(result).toMatchObject({
      type: "expense",
      amountMinor: 84_000,
      categoryCode: "restaurants",
      accountType: "cash",
      daysAgo: 1,
    });
  });

  it('"Добавь доход 50 тысяч, оплата от клиента"', () => {
    const result = parseCommand("Добавь доход 50 тысяч, оплата от клиента");
    expect(result).toMatchObject({ type: "income", amountMinor: 5_000_000 });
  });
});
