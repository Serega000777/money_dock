import { ConfigService } from "@nestjs/config";

import type { Env } from "../../../config/env";

import { GigaChatProvider } from "./gigachat.provider";

describe("GigaChatProvider", () => {
  afterEach(() => jest.restoreAllMocks());

  function configWith(values: Partial<Env>): ConfigService<Env, true> {
    return { get: (key: keyof Env) => values[key] } as ConfigService<Env, true>;
  }

  it("exchanges the authorization key for a token, then calls the devices.sberbank.ru completions endpoint", async () => {
    const values: Partial<Env> = {
      GIGACHAT_AUTHORIZATION_KEY: "secret",
      GIGACHAT_SCOPE: "GIGACHAT_API_PERS",
      GIGACHAT_MODEL: "GigaChat-2",
    };
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: "token-1", expires_at: Date.now() + 1_800_000 }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: "Привет!" } }],
            usage: { prompt_tokens: 3, completion_tokens: 2 },
          }),
          { status: 200 },
        ),
      );

    const result = await new GigaChatProvider(configWith(values)).chat([
      { role: "user", content: "Привет" },
    ]);

    expect(result.provider).toBe("gigachat");
    expect(result.content).toBe("Привет!");
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://ngw.devices.sberbank.ru:9443/api/v2/oauth",
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Basic secret" }) }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://gigachat.devices.sberbank.ru/api/v1/chat/completions",
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer token-1" }) }),
    );
  });

  it("reuses a cached token instead of re-authenticating on every call", async () => {
    const values: Partial<Env> = {
      GIGACHAT_AUTHORIZATION_KEY: "secret",
      GIGACHAT_SCOPE: "GIGACHAT_API_PERS",
      GIGACHAT_MODEL: "GigaChat-2",
    };
    const chatResponse = () =>
      new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }), { status: 200 });
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: "token-1", expires_at: Date.now() + 1_800_000 }), {
          status: 200,
        }),
      )
      .mockImplementation(() => Promise.resolve(chatResponse()));

    const provider = new GigaChatProvider(configWith(values));
    await provider.chat([{ role: "user", content: "1" }]);
    await provider.chat([{ role: "user", content: "2" }]);

    const oauthCalls = fetchMock.mock.calls.filter(([url]) => String(url).includes("/oauth"));
    expect(oauthCalls).toHaveLength(1);
  });

  it("throws a retryable error when GigaChat is not configured", async () => {
    const provider = new GigaChatProvider(configWith({}));
    await expect(provider.chat([{ role: "user", content: "hi" }]))
      .rejects.toMatchObject({ status: 503, retryable: true });
  });
});
