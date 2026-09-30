import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import type { Env } from "../../config/env";

import type { SpeechToTextProvider, SpeechTranscriptionResult } from "./speech-provider";

const execFileAsync = promisify(execFile);
const TIMEOUT_MS = 30_000;

export class SpeechProviderError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "SpeechProviderError";
  }
}

interface YandexResponse {
  result?: string;
  error_code?: string;
  error_message?: string;
}

/** Short-command adapter for SpeechKit's synchronous API. That API accepts Ogg/Opus
 * and raw LPCM only, while iOS records m4a/mp4 and Chromium commonly records webm.
 * Production therefore converts the ephemeral upload to Ogg/Opus with ffmpeg; neither
 * the source nor converted audio is persisted after this call. */
@Injectable()
export class YandexSpeechKitProvider implements SpeechToTextProvider {
  readonly name = "yandex";

  constructor(private readonly config: ConfigService<Env, true>) {}

  async transcribe(audio: Buffer, mimeType: string): Promise<SpeechTranscriptionResult> {
    if (!audio.length) throw new SpeechProviderError("empty audio", 400, false);
    const apiKey = this.config.get("YANDEX_SPEECHKIT_API_KEY", { infer: true });
    if (!apiKey) throw new SpeechProviderError("provider is not configured", 503, true);

    const startedAt = Date.now();
    const oggAudio = await this.toOggOpus(audio, mimeType);
    // v1 synchronous recognition has a hard 1 MB / 30 second limit. Enforce the byte
    // limit after conversion so a large browser container cannot bypass it.
    if (oggAudio.length > 1024 * 1024)
      throw new SpeechProviderError("audio exceeds SpeechKit synchronous limit", 413, false);

    const query = new URLSearchParams({
      lang: "ru-RU",
      topic: this.config.get("YANDEX_SPEECHKIT_MODEL", { infer: true }),
      format: "oggopus",
      rawResults: "false",
    });
    const folderId = this.config.get("YANDEX_FOLDER_ID", { infer: true });
    if (folderId) query.set("folderId", folderId);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetch(
        `https://stt.api.cloud.yandex.net/speech/v1/stt:recognize?${query}`,
        {
          method: "POST",
          headers: { Authorization: `Api-Key ${apiKey}`, "Content-Type": "audio/ogg" },
          body: new Uint8Array(oggAudio),
          signal: controller.signal,
        },
      );
      const body = (await response.json().catch(() => ({}))) as YandexResponse;
      if (!response.ok) {
        throw new SpeechProviderError(
          body.error_message ?? `SpeechKit HTTP ${response.status}`,
          response.status,
          response.status === 429 || response.status >= 500,
        );
      }
      const text = body.result?.trim() ?? "";
      if (!text) throw new SpeechProviderError("no speech", 422, false);
      return { text, provider: this.name, durationMs: Date.now() - startedAt };
    } catch (error) {
      if (error instanceof SpeechProviderError) throw error;
      throw new SpeechProviderError(
        error instanceof Error ? error.message : "SpeechKit network error",
        503,
        true,
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  private async toOggOpus(audio: Buffer, mimeType: string): Promise<Buffer> {
    const normalizedMime = mimeType.split(";", 1)[0]?.toLowerCase().trim();
    if (normalizedMime === "audio/ogg" || normalizedMime === "application/ogg") return audio;
    const supported = new Set([
      "audio/mp4",
      "audio/x-m4a",
      "audio/m4a",
      "audio/webm",
      "video/webm",
      "audio/mpeg",
      "audio/mp3",
      "audio/wav",
      "audio/x-wav",
    ]);
    if (!normalizedMime || !supported.has(normalizedMime))
      throw new SpeechProviderError("unsupported audio format", 415, false);

    const directory = await mkdtemp(join(tmpdir(), "amola-speech-"));
    const source = join(directory, `${randomUUID()}.input`);
    const target = join(directory, `${randomUUID()}.ogg`);
    try {
      await writeFile(source, audio);
      await execFileAsync(
        "ffmpeg",
        ["-v", "error", "-y", "-i", source, "-t", "30", "-ac", "1", "-c:a", "libopus", target],
        { timeout: TIMEOUT_MS, windowsHide: true },
      );
      return await readFile(target);
    } catch {
      throw new SpeechProviderError("audio conversion failed", 415, false);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }
}
