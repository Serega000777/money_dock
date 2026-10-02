import { Module } from "@nestjs/common";
import { CommandsModule } from "../commands/commands.module";
import { EntitlementsModule } from "../entitlements/entitlements.module";
import { ShortcutCaptureController, ShortcutCredentialsController } from "./shortcuts.controller";
import { ShortcutsService } from "./shortcuts.service";

@Module({
  imports: [CommandsModule, EntitlementsModule],
  controllers: [ShortcutCredentialsController, ShortcutCaptureController],
  providers: [ShortcutsService],
})
export class ShortcutsModule {}
