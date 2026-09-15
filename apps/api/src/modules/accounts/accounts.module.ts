import { Module } from "@nestjs/common";

import { EntitlementsModule } from "../entitlements/entitlements.module";

import { AccountsController } from "./accounts.controller";
import { AccountsService } from "./accounts.service";

@Module({
  imports: [EntitlementsModule],
  controllers: [AccountsController],
  providers: [AccountsService],
  exports: [AccountsService],
})
export class AccountsModule {}
