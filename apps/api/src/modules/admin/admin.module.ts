import { Module } from "@nestjs/common";

import { EntitlementsModule } from "../entitlements/entitlements.module";
import { UsersModule } from "../users/users.module";

import { AdminController } from "./admin.controller";
import { AdminGuard } from "./admin.guard";
import { AdminService } from "./admin.service";

@Module({
  imports: [UsersModule, EntitlementsModule],
  controllers: [AdminController],
  providers: [AdminGuard, AdminService],
})
export class AdminModule {}
