import { Module } from "@nestjs/common";

import { SpeechService } from "./speech.service";
import { SpeechController } from "./speech.controller";
import { YandexSpeechKitProvider } from "./yandex-speechkit.provider";

@Module({
  controllers: [SpeechController],
  providers: [SpeechService, YandexSpeechKitProvider],
  exports: [SpeechService],
})
export class SpeechModule {}
