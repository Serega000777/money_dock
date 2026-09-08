import { Module } from "@nestjs/common";

import { CsvBankProvider } from "./csv-bank-provider";
import { ManualBankProvider } from "./manual-bank-provider";

/**
 * No controller: `BankProvider` is a contract other modules depend on (see
 * bank-provider.ts), not an HTTP surface of its own. Registered here so both adapters
 * are ready for a future consumer (an official Open Banking provider joining them, or
 * ImportModule adopting CsvBankProvider) without a wiring change at that point.
 */
@Module({
  providers: [ManualBankProvider, CsvBankProvider],
  exports: [ManualBankProvider, CsvBankProvider],
})
export class BankingModule {}
