import { ManualBankProvider } from "./manual-bank-provider";

describe("ManualBankProvider", () => {
  const provider = new ManualBankProvider();

  it("has no authorization flow — there is no external bank to authorize", async () => {
    await expect(provider.getAuthorizationUrl()).rejects.toThrow();
    await expect(provider.exchangeAuthorizationCode()).rejects.toThrow();
  });

  it("has nothing to sync", async () => {
    await expect(provider.getAccounts()).resolves.toEqual([]);
    await expect(provider.getTransactions()).resolves.toEqual({
      transactions: [],
      nextCursor: null,
    });
  });

  it("revokeAccess is a no-op", async () => {
    await expect(provider.revokeAccess()).resolves.toBeUndefined();
  });
});
