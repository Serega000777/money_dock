import { Module } from "@nestjs/common";

import { AccountsModule } from "../accounts/accounts.module";
import { CategoriesModule } from "../categories/categories.module";
import { EntitlementsModule } from "../entitlements/entitlements.module";
import { UsersModule } from "../users/users.module";

import { ExportController } from "./export.controller";
import { ExportService } from "./export.service";

@Module({
  imports: [AccountsModule, CategoriesModule, EntitlementsModule, UsersModule],
  controllers: [ExportController],
  providers: [ExportService],
})
export class ExportModule {}
