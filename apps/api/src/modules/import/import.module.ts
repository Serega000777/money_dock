import { Module } from "@nestjs/common";

import { AccountsModule } from "../accounts/accounts.module";
import { CategorizationModule } from "../categorization/categorization.module";
import { TransactionsModule } from "../transactions/transactions.module";

import { ImportController } from "./import.controller";
import { ImportService } from "./import.service";

@Module({
  imports: [AccountsModule, CategorizationModule, TransactionsModule],
  controllers: [ImportController],
  providers: [ImportService],
})
export class ImportModule {}
