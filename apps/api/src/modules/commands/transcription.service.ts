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
  candidates?: { content?: { parts?: { text?: string }[] } }[];
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
      throw new ServiceUnavailableException(
        "Голосовой ввод сейчас недоступен на этом устройстве",
      );
    }
    const model = this.config.get("GEMINI_MODEL", { infer: true });

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: PROMPT },
                { inline_data: { mime_type: mimeType, data: audio.toString("base64") } },
              ],
            },
          ],
          generationConfig: { temperature: 0 },
        }),
      },
    );

    if (!res.ok) {
      this.logger.error(`Gemini transcription failed: ${res.status} ${await res.text()}`);
      throw new InternalServerErrorException("Не удалось распознать речь");
    }

    const body = (await res.json()) as GeminiResponse;
    const text = body.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
    if (!text) throw new BadRequestException("Не удалось расслышать сумму");
    return text;
  }
}
