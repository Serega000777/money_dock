import { parseTotalsQuery } from "./totals-query";

const norm = (text: string) => text.toLowerCase().replace(/ё/g, "е");

describe("parseTotalsQuery", () => {
  it.each([
    ["Сколько доходов в сентябре?", "income", { kind: "month", monthIndex: 8 }],
    ["сколько я заработал в сентябре", "income", { kind: "month", monthIndex: 8 }],
    ["покажи доходы за прошлый месяц", "income", { kind: "prev_month" }],
    ["сколько всего заработал", "income", { kind: "all_time" }],
    ["сколько потратил вчера", "expense", { kind: "yesterday" }],
    ["расходы за 30 дней", "expense", { kind: "last_days", days: 30 }],
    ["доходы и расходы за сентябрь", "both", { kind: "month", monthIndex: 8 }],
    ["сколько получил в этом году", "income", { kind: "this_year" }],
  ])("reads %s", (text, type, period) => {
    expect(parseTotalsQuery(norm(text))).toMatchObject({ type, period });
  });

  it("keeps a bare follow-up's type open so conversation context can fill it in", () => {
    expect(parseTotalsQuery(norm("А в августе"))).toMatchObject({
      type: null,
      period: { kind: "month", monthIndex: 7 },
    });
  });

  it.each(["кофе 350", "потратил 500 на бензин вчера", "получил зарплату 100000", "привет"])(
    "leaves %s alone — a command or chatter, not a totals question",
    (text) => {
      expect(parseTotalsQuery(norm(text))).toBeNull();
    },
  );
});
