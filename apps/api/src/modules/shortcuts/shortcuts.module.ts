import { Module } from "@nestjs/common";
import { CommandsModule } from "../commands/commands.module";
import { ShortcutCaptureController, ShortcutCredentialsController } from "./shortcuts.controller";
import { ShortcutsService } from "./shortcuts.service";

@Module({ imports: [CommandsModule], controllers: [ShortcutCredentialsController, ShortcutCaptureController], providers: [ShortcutsService] })
export class ShortcutsModule {}
