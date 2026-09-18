import { Module } from "@nestjs/common";

import { AccountsModule } from "../accounts/accounts.module";

import { CategorizationService } from "./categorization.service";

@Module({
  imports: [AccountsModule],
  providers: [CategorizationService],
  exports: [CategorizationService],
})
export class CategorizationModule {}
