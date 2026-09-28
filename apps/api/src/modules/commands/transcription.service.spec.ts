import { ConfigService } from "@nestjs/config";

import type { Env } from "../../config/env";

import { TranscriptionService } from "./transcription.service";

describe("TranscriptionService", () => {
  afterEach(() => jest.restoreAllMocks());

  function service(values: Partial<Env>) {
    return new TranscriptionService({
      get: (key: keyof Env) => values[key],
    } as ConfigService<Env, true>);
  }

  it("uses the dedicated OpenAI transcription endpoint when its key is configured", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ text: "Потратил 500 рублей на кофе" }),
    } as Response);

    const text = await service({
      OPENAI_API_KEY: "test-openai-key",
      OPENAI_TRANSCRIPTION_MODEL: "gpt-transcribe",
    }).transcribe(Buffer.from("audio"), "audio/mp4;codecs=mp4a.40.2");

    expect(text).toBe("Потратил 500 рублей на кофе");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.openai.com/v1/audio/transcriptions",
      expect.objectContaining({
        method: "POST",
        headers: { Authorization: "Bearer test-openai-key" },
        body: expect.any(FormData),
      }),
    );
    const form = fetchMock.mock.calls[0]?.[1]?.body as FormData;
    expect(form.get("model")).toBe("gpt-transcribe");
    expect((form.get("file") as File).type).toBe("audio/mp4");
  });

  it("falls back to Gemini when OpenAI is temporarily unavailable", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        text: async () => "temporary outage",
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: "Доход 5000 зарплата" }] } }],
        }),
      } as Response);

    const text = await service({
      OPENAI_API_KEY: "test-openai-key",
      OPENAI_TRANSCRIPTION_MODEL: "gpt-transcribe",
      GEMINI_API_KEY: "test-gemini-key",
      GEMINI_MODEL: "gemini-3.8-flash",
    }).transcribe(Buffer.from("audio"), "audio/webm");

    expect(text).toBe("Доход 5000 зарплата");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
