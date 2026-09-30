import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import type { Env } from "../../config/env";

import type { SpeechTranscriptionResult } from "./speech-provider";
import { SpeechProviderError, YandexSpeechKitProvider } from "./yandex-speechkit.provider";

@Injectable()
export class SpeechService {
  private readonly logger = new Logger(SpeechService.name);

  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly yandex: YandexSpeechKitProvider,
  ) {}

  async transcribe(audio: Buffer, mimeType: string): Promise<SpeechTranscriptionResult> {
    const provider = this.config.get("SPEECH_PROVIDER", { infer: true });
    if (provider !== "yandex")
      throw new ServiceUnavailableException(
        "Голосовой ввод временно недоступен. Можно ввести команду текстом.",
      );
    try {
      const result = await this.yandex.transcribe(audio, mimeType);
      this.logger.log(
        JSON.stringify({
          type: "speech_transcription",
          provider: result.provider,
          latencyMs: result.durationMs,
        }),
      );
      return result;
    } catch (error) {
      const providerError =
        error instanceof SpeechProviderError
          ? error
          : new SpeechProviderError("unknown provider error", 503, true);
      // Never log the transcript, raw provider body, audio, or credentials.
      this.logger.error(
        JSON.stringify({
          type: "speech_transcription_failed",
          provider: "yandex",
          status: providerError.status,
          retryable: providerError.retryable,
        }),
      );
      if ([400, 413, 415, 422].includes(providerError.status))
        throw new BadRequestException("Не удалось распознать речь. Попробуйте ещё раз.");
      throw new ServiceUnavailableException(
        "Голосовой ввод временно недоступен. Можно ввести команду текстом.",
      );
    }
  }
}

