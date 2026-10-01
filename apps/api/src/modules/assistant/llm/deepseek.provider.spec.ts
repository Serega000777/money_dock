import { ConfigService } from "@nestjs/config";

import type { Env } from "../../../config/env";
import { DeepSeekProvider } from "./deepseek.provider";

describe("DeepSeekProvider", () => {
  afterEach(() => jest.restoreAllMocks());

  it("uses the Yandex OpenAI-compatible endpoint and Api-Key auth", async () => {
    const values: Partial<Env> = {
      DEEPSEEK_API_KEY: "secret",
      DEEPSEEK_MODEL: "gpt://folder/deepseek-v4-flash",
      DEEPSEEK_BASE_URL: "https://ai.api.cloud.yandex.net/v1",
      DEEPSEEK_AUTH_SCHEME: "api-key",
    };
    const config = { get: (key: keyof Env) => values[key] } as ConfigService<Env, true>;
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: "{\"intent\":\"balance\",\"commands\":[]}" } }],
      usage: { prompt_tokens: 10, completion_tokens: 5 },
    }), { status: 200, headers: { "Content-Type": "application/json" } }));

    const result = await new DeepSeekProvider(config).chat([{ role: "user", content: "Баланс" }]);

    expect(result.provider).toBe("deepseek");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://ai.api.cloud.yandex.net/v1/chat/completions",
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Api-Key secret" }) }),
    );
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(String(request.body));
    expect(body).not.toHaveProperty("thinking");
    // Without this, a reasoning model spends max_tokens on reasoning_content and
    // `content` comes back null before it ever answers.
    expect(body.reasoning_effort).toBe("none");
  });
});
