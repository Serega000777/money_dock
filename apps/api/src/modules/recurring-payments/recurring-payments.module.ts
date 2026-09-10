import { Module } from "@nestjs/common";

import { AccountsModule } from "../accounts/accounts.module";
import { TransactionsModule } from "../transactions/transactions.module";

import { RecurringPaymentsController } from "./recurring-payments.controller";
import { RecurringPaymentsService } from "./recurring-payments.service";

@Module({
  imports: [AccountsModule, TransactionsModule],
  controllers: [RecurringPaymentsController],
  providers: [RecurringPaymentsService],
})
export class RecurringPaymentsModule {}
