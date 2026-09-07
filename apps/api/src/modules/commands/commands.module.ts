import { Module } from "@nestjs/common";

import { EntitlementsModule } from "../entitlements/entitlements.module";

import { CommandsController } from "./commands.controller";
import { CommandsService } from "./commands.service";

@Module({
  imports: [EntitlementsModule],
  controllers: [CommandsController],
  providers: [CommandsService],
})
export class CommandsModule {}
