import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import type { Env } from "../../config/env";

/** Kept short and directive — Gemini otherwise happily adds "Конечно, вот
 * транскрипция:" or translates a stray English word instead of leaving it alone. */
const PROMPT =
  "Transcribe the spoken Russian in this audio clip exactly as said. The speaker is " +
  "describing one expense or income transaction out loud — an amount, what it was for, " +
  "maybe a category or account. Output only the raw transcription in Russian: no quotes, " +
  "no translation, no preamble, no commentary. If you cannot make out any speech, output " +
  "nothing at all.";

interface GeminiResponse {
  output_text?: string;
  steps?: { content?: { type?: string; text?: string }[] }[];
}

/**
 * Server-side speech-to-text for clients with no `SpeechRecognition` of their own —
 * every iOS browser (WebKit has never implemented it), Telegram's iOS Mini App WebView
 * included. The client records audio instead (`MediaRecorder`, which Safari does
 * support) and this turns it into text the same `CommandsService.parse` pipeline reads.
 */
@Injectable()
export class TranscriptionService {
  private readonly logger = new Logger(TranscriptionService.name);

  constructor(private readonly config: ConfigService<Env, true>) {}

  async transcribe(audio: Buffer, mimeType: string): Promise<string> {
    const apiKey = this.config.get("GEMINI_API_KEY", { infer: true });
    if (!apiKey) {
      throw new ServiceUnavailableException("Голосовой ввод сейчас недоступен на этом устройстве");
    }
    const model = this.config.get("GEMINI_MODEL", { infer: true });

    // Gemini retired generateContent for the model Claude originally wired here. The
    // current Interactions API has a dedicated transcription model and accepts short
    // audio clips inline, which is exactly this endpoint's workload.
    const res = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        model,
        system_instruction: PROMPT,
        input: [{ type: "audio", data: audio.toString("base64"), mime_type: mimeType }],
      }),
    });

    if (!res.ok) {
      const details = (await res.text()).slice(0, 500);
      this.logger.error(`Gemini transcription failed: ${res.status} ${details}`);
      if (res.status === 401 || res.status === 403) {
        throw new ServiceUnavailableException("Сервис распознавания речи требует настройки");
      }
      throw new InternalServerErrorException("Не удалось распознать речь");
    }

    const body = (await res.json()) as GeminiResponse;
    const text =
      body.output_text?.trim() ??
      body.steps
        ?.flatMap((step) => step.content ?? [])
        .find((content) => content.type === "text")
        ?.text?.trim() ??
      "";
    if (!text) throw new BadRequestException("Не удалось расслышать сумму");
    return text;
  }
}
