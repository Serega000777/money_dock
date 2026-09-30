import { ConfigService } from "@nestjs/config";

import type { Env } from "../../config/env";

import { SpeechProviderError, YandexSpeechKitProvider } from "./yandex-speechkit.provider";

function provider(overrides: Record<string, string | undefined> = {}) {
  const values: Record<string, string | undefined> = {
    YANDEX_SPEECHKIT_API_KEY: "test-key",
    YANDEX_FOLDER_ID: "folder-id",
    YANDEX_SPEECHKIT_MODEL: "general",
    ...overrides,
  };
  return new YandexSpeechKitProvider({
    get: (key: string) => values[key],
  } as unknown as ConfigService<Env, true>);
}

describe("YandexSpeechKitProvider", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("sends short Ogg/Opus audio to the official synchronous endpoint", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      new Response(JSON.stringify({ result: "вчера бензин 4000" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(provider().transcribe(Buffer.from("ogg"), "audio/ogg")).resolves.toMatchObject({
      text: "вчера бензин 4000",
      provider: "yandex",
    });
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("stt.api.cloud.yandex.net/speech/v1/stt:recognize"),
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Api-Key test-key" }),
      }),
    );
  });

  it("marks quota failures as retryable without leaking the provider response", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      new Response(JSON.stringify({ error_message: "quota" }), {
        status: 429,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(provider().transcribe(Buffer.from("ogg"), "audio/ogg")).rejects.toMatchObject<
      Partial<SpeechProviderError>
    >({ status: 429, retryable: true });
  });

  it("rejects empty and unsupported uploads before making a network request", async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock;
    await expect(provider().transcribe(Buffer.alloc(0), "audio/ogg")).rejects.toMatchObject({
      status: 400,
    });
    await expect(provider().transcribe(Buffer.from("x"), "text/plain")).rejects.toMatchObject({
      status: 415,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
