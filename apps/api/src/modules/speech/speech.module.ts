import { Module } from "@nestjs/common";

import { SpeechService } from "./speech.service";
import { YandexSpeechKitProvider } from "./yandex-speechkit.provider";

@Module({
  providers: [SpeechService, YandexSpeechKitProvider],
  exports: [SpeechService],
})
export class SpeechModule {}

