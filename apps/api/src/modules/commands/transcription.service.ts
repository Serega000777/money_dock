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

const TRANSCRIPTION_TIMEOUT_MS = 30_000;
const FALLBACK_MODEL = "gemini-flash-latest";

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
    const openAiKey = this.config.get("OPENAI_API_KEY", { infer: true });
    const apiKey = this.config.get("GEMINI_API_KEY", { infer: true });
    if (!openAiKey && !apiKey) {
      throw new ServiceUnavailableException("Голосовой ввод сейчас недоступен на этом устройстве");
    }

    if (openAiKey) {
      const openAiResult = await this.transcribeWithOpenAi(openAiKey, audio, mimeType);
      if (openAiResult.ok) {
        const text = openAiResult.text.trim();
        if (!text) throw new BadRequestException("Не удалось расслышать сумму");
        return text;
      }
      this.logger.error(
        `OpenAI transcription failed: ${openAiResult.status} ${openAiResult.details}`,
      );
      // A second provider protects voice capture from a regional/provider outage. Do
      // not retry client errors caused by an unreadable recording through Gemini.
      if (
        !apiKey ||
        (openAiResult.status >= 400 && openAiResult.status < 500 && openAiResult.status !== 429)
      ) {
        this.throwProviderFailure(openAiResult.status);
      }
    }

    if (!apiKey) {
      throw new ServiceUnavailableException("Сервис распознавания речи временно недоступен");
    }
    const configuredModel = this.config.get("GEMINI_MODEL", { infer: true });
    const models =
      configuredModel === FALLBACK_MODEL ? [configuredModel] : [configuredModel, FALLBACK_MODEL];
    let lastFailure: { status: number; details: string } | null = null;

    for (const model of models) {
      const result = await this.generateContent(apiKey, model, audio, mimeType);
      if (result.ok) {
        const text =
          result.body.candidates?.[0]?.content?.parts
            ?.map((part) => part.text ?? "")
            .join("")
            .trim() ?? "";
        if (!text) throw new BadRequestException("Не удалось расслышать сумму");
        return text;
      }

      lastFailure = result;
      this.logger.error(
        `Gemini transcription failed (${model}): ${result.status} ${result.details}`,
      );
      // Retry with the stable alias when a configured model is unavailable to this API
      // key. Other failures (bad audio, quota, upstream outage) will not improve merely
      // by changing the model and should be returned immediately.
      if (![403, 404].includes(result.status)) break;
    }

    this.throwProviderFailure(lastFailure?.status ?? 500);
  }

  private async transcribeWithOpenAi(
    apiKey: string,
    audio: Buffer,
    mimeType: string,
  ): Promise<{ ok: true; text: string } | { ok: false; status: number; details: string }> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TRANSCRIPTION_TIMEOUT_MS);
    const normalizedMime = mimeType.split(";", 1)[0]?.trim() || "audio/mp4";
    const extension = this.extensionForMime(normalizedMime);
    const form = new FormData();
    form.append(
      "file",
      new Blob([new Uint8Array(audio)], { type: normalizedMime }),
      `command.${extension}`,
    );
    form.append("model", this.config.get("OPENAI_TRANSCRIPTION_MODEL", { infer: true }));
    form.append(
      "prompt",
      "Финансовая операция на русском языке: расход или доход, сумма, категория и счёт.",
    );
    form.append("languages[]", "ru");

    try {
      const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
        signal: controller.signal,
      });
      if (!res.ok) {
        return { ok: false, status: res.status, details: (await res.text()).slice(0, 500) };
      }
      const body = (await res.json()) as { text?: string };
      return { ok: true, text: body.text ?? "" };
    } catch (error) {
      return {
        ok: false,
        status: 503,
        details: error instanceof Error ? error.message : "network error",
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  private extensionForMime(mimeType: string): string {
    if (mimeType.includes("webm")) return "webm";
    if (mimeType.includes("wav")) return "wav";
    if (mimeType.includes("ogg")) return "ogg";
    if (mimeType.includes("mpeg") || mimeType.includes("mp3")) return "mp3";
    return "m4a";
  }

  private throwProviderFailure(status: number): never {
    if (status === 401 || status === 403) {
      throw new ServiceUnavailableException("Сервис распознавания речи требует настройки");
    }
    if (status === 429 || status === 503) {
      throw new ServiceUnavailableException("Сервис распознавания перегружен. Попробуйте ещё раз");
    }
    throw new InternalServerErrorException("Не удалось распознать речь");
  }

  private async generateContent(
    apiKey: string,
    model: string,
    audio: Buffer,
    mimeType: string,
  ): Promise<{ ok: true; body: GeminiResponse } | { ok: false; status: number; details: string }> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TRANSCRIPTION_TIMEOUT_MS);
    // WebKit commonly includes codec parameters (for example
    // audio/mp4;codecs=mp4a.40.2). Gemini expects the media type itself.
    const normalizedMime = mimeType.split(";", 1)[0]?.trim() || "audio/mp4";

    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
          signal: controller.signal,
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [
                  { text: PROMPT },
                  { inlineData: { mimeType: normalizedMime, data: audio.toString("base64") } },
                ],
              },
            ],
            generationConfig: { temperature: 0, maxOutputTokens: 256 },
          }),
        },
      );
      if (!res.ok) {
        return { ok: false, status: res.status, details: (await res.text()).slice(0, 500) };
      }
      return { ok: true, body: (await res.json()) as GeminiResponse };
    } catch (error) {
      const details = error instanceof Error ? error.message : "network error";
      return { ok: false, status: 503, details };
    } finally {
      clearTimeout(timeout);
    }
  }
}
