import { describe, expect, it } from "vitest";

import {
  detectColumns,
  parseAmountToMinor,
  parseRowDate,
  rowsFromPdfTables,
  rowsFromStatementText,
} from "./import";

/** Text as pdf-parse extracts an Ozon Bank "Справка о движении средств": header block with
 * dates of its own, then each operation spread over several lines. Synthetic data. */
const OZON_TEXT = [
  "ООО «ОЗОН Банк», 123112, город Москва",
  "Справка о движении средств",
  "№ Ф-2026-36754933 от «01» октября 2026 года",
  "Номер лицевого счёта: № 40817810400000000000, открыт 06.11.2023",
  "Дата и время формирования документа: 01.10.2026 12:20:27",
  "Период выписки: 01.09.2026 — 30.09.2026",
  "Входящий остаток: 32.89 ₽",
  "Дата",
  "операции",
  "Документ \tНазначение платежа \tСумма операции",
  "Российские",
  "рубли",
  "Валюта",
  "30.09.2026",
  "18:45:33",
  "13863537084 Оплата товаров по карте 8881 сумма 220.00 в Chao",
  "Simferopol RU дата 2026-09-30 время 18:50:12",
  "- 220.00 ₽ \t- 220.00 ₽",
  "29.09.2026",
  "15:04:19",
  "9327390724 Перевод A6272120416610IB0B1004 0011851301 через",
  "СБП. Получатель: Тимур Игоревич С. Без НДС.",
  "- 25 000.00 ₽ - 25 000.00 ₽",
  "1",
  "-- 1 of 19 --",
  "29.09.2026",
  "15:02:54",
  "13829091493 Взнос наличных денежных средств по карте 8881",
  "сумма 25000.00 в Bank VTB (PAO) g. Simferopol RU",
  "дата 2026-09-29 время 15:02:54",
  "+ 25 000.00 ₽ + 25 000.00 ₽",
  "28.09.2026 15:17:37 9311087331 Платеж в пользу МТС, 9183777692. НДС не облагается \t- 1 468.95 ₽ \t- 1 468.95 ₽",
  "Исходящий остаток: 1 234.56 ₽",
].join("\n");

function asTransactions(rows: string[][]) {
  const [header, ...data] = rows;
  const columns = detectColumns(header!);
  return data.map((row) => ({
    date: parseRowDate(row[columns.date]!).toISOString().slice(0, 10),
    amountMinor: parseAmountToMinor(row[columns.amount]!),
    merchant: row[columns.merchant!],
  }));
}

describe("rowsFromStatementText", () => {
  it("reads an Ozon-style statement where each operation spans several lines", () => {
    const txs = asTransactions(rowsFromStatementText(OZON_TEXT));
    expect(txs).toEqual([
      { date: "2026-09-30", amountMinor: -22_000, merchant: "Chao Simferopol RU" },
      { date: "2026-09-29", amountMinor: -2_500_000, merchant: "Перевод СБП: Тимур Игоревич С" },
      {
        date: "2026-09-29",
        amountMinor: 2_500_000,
        merchant: "Взнос наличных: Bank VTB (PAO) g. Simferopol RU",
      },
      { date: "2026-09-28", amountMinor: -146_895, merchant: "Платеж в пользу МТС, 9183777692" },
    ]);
  });

  it("never takes a time, a document number or a date inside the purpose for the amount", () => {
    const txs = asTransactions(rowsFromStatementText(OZON_TEXT));
    expect(txs.map((t) => t.amountMinor)).not.toContain(1_800);
    // The bank's document id leads each record; it must not lead the purpose text.
    expect(txs.every((t) => !/^\d{6,}/.test(t.merchant ?? ""))).toBe(true);
  });

  it("treats unsigned figures as spending when the statement only marks income with +", () => {
    const sberLike = [
      "15.09.2026 Супермаркеты ПЯТЁРОЧКА 1 250,50 48 749,50",
      "16.09.2026 Перевод на карту ЗАРПЛАТА +50 000,00 98 749,50",
    ].join("\n");
    const txs = asTransactions(rowsFromStatementText(sberLike));
    expect(txs.map((t) => t.amountMinor)).toEqual([-125_050, 5_000_000]);
  });

  it("finds nothing in a document without operations", () => {
    expect(rowsFromStatementText("Statement summary\nNo transactions this period")).toHaveLength(1);
  });
});

describe("rowsFromPdfTables", () => {
  it("uses the header from the first page for the headerless continuation pages", () => {
    const page1 = [
      ["Дата операции", "Документ", "Назначение платежа", "Сумма операции", ""],
      ["", "", "", "Российские рубли", "Валюта"],
      [
        "30.09.2026 18:45:33",
        "13863537084",
        "Оплата товаров по карте 8881 сумма 220.00 в Chao Simferopol RU дата 2026-09-30 время 18:50:12",
        "- 220.00 ₽",
        "- 220.00 ₽",
      ],
    ];
    const page2 = [
      [
        "28.09.2026 20:41:17",
        "9316944675",
        "Перевод через СБП. Отправитель: Ксения Павловна С. Без НДС.",
        "+ 500.00 ₽",
        "+ 500.00 ₽",
      ],
    ];
    const txs = asTransactions(rowsFromPdfTables([page1, page2])!);
    expect(txs).toEqual([
      { date: "2026-09-30", amountMinor: -22_000, merchant: "Chao Simferopol RU" },
      { date: "2026-09-28", amountMinor: 50_000, merchant: "Перевод СБП: Ксения Павловна С" },
    ]);
  });

  it("infers the columns from their contents when no header row was extracted", () => {
    const table = [
      ["13863537084", "30.09.2026", "Пятёрочка", "-1 250,50"],
      ["13863537085", "29.09.2026", "Зарплата", "+50 000,00"],
    ];
    const txs = asTransactions(rowsFromPdfTables([table])!);
    expect(txs.map((t) => [t.date, t.amountMinor, t.merchant])).toEqual([
      ["2026-09-30", -125_050, "Пятёрочка"],
      ["2026-09-29", 5_000_000, "Зарплата"],
    ]);
  });

  it("returns null for tables with no operations in them", () => {
    expect(rowsFromPdfTables([[["Владелец", "Тестов Т.Т."]]])).toBeNull();
  });
});
