import { CsvBankProvider } from "./csv-bank-provider";

const provider = new CsvBankProvider();

function csvInput(csv: string) {
  return { connectionToken: { provider: "csv", payload: { buffer: Buffer.from(csv, "utf8") } } };
}

describe("CsvBankProvider", () => {
  it("normalizes rows into external transactions", async () => {
    const csv = "Дата;Сумма;Назначение\n15.03.2026;-840;Кафе Уют\n16.03.2026;50000;Зарплата\n";

    const page = await provider.getTransactions(csvInput(csv));

    expect(page.nextCursor).toBeNull();
    expect(page.transactions).toEqual([
      {
        occurredAt: new Date(Date.UTC(2026, 2, 15)).toISOString(),
        amountMinor: 84_000,
        type: "expense",
        merchant: "Кафе Уют",
      },
      {
        occurredAt: new Date(Date.UTC(2026, 2, 16)).toISOString(),
        amountMinor: 5_000_000,
        type: "income",
        merchant: "Зарплата",
      },
    ]);
  });

  it("rejects a file with only a header", async () => {
    await expect(provider.getTransactions(csvInput("Дата;Сумма\n"))).rejects.toThrow(
      "Файл пустой или содержит только заголовок",
    );
  });

  it("rejects a header missing the required columns", async () => {
    await expect(provider.getTransactions(csvInput("Описание\nтест\n"))).rejects.toThrow(
      "В файле не найдена колонка с датой",
    );
  });

  it("has no authorization flow — a file upload isn't OAuth", async () => {
    await expect(provider.getAuthorizationUrl()).rejects.toThrow();
    await expect(provider.exchangeAuthorizationCode()).rejects.toThrow();
  });

  it("getAccounts and revokeAccess are no-ops", async () => {
    await expect(provider.getAccounts()).resolves.toEqual([]);
    await expect(provider.revokeAccess()).resolves.toBeUndefined();
  });
});
