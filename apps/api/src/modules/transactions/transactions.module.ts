import { Module } from "@nestjs/common";

import { AccountsModule } from "../accounts/accounts.module";
import { CategorizationModule } from "../categorization/categorization.module";

import { TransactionsController } from "./transactions.controller";
import { TransactionsService } from "./transactions.service";

@Module({
  imports: [AccountsModule, CategorizationModule],
  controllers: [TransactionsController],
  providers: [TransactionsService],
  exports: [TransactionsService],
})
export class TransactionsModule {}
