import { BadRequestException, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import type { Env } from "../../config/env";
import { ReceiptVisionService } from "./receipt-vision.service";

describe("ReceiptVisionService", () => {
  afterEach(() => jest.restoreAllMocks());

  function configWith(values: Partial<Env>): ConfigService<Env, true> {
    return { get: (key: keyof Env) => values[key] } as ConfigService<Env, true>;
  }

  const CONFIGURED: Partial<Env> = {
    DEEPSEEK_API_KEY: "secret",
    DEEPSEEK_VISION_MODEL: "gpt://folder/deepseek-v4.1-flash",
    DEEPSEEK_BASE_URL: "https://ai.api.cloud.yandex.net/v1",
    DEEPSEEK_AUTH_SCHEME: "api-key",
  };

  it("sends the image as a data URI and returns the model's short phrase", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({ choices: [{ message: { content: "454 Пятёрочка" } }] }),
        { status: 200 },
      ),
    );

    const result = await new ReceiptVisionService(configWith(CONFIGURED)).describe(
      Buffer.from("fake-jpeg-bytes"),
      "image/jpeg",
    );

    expect(result).toBe("454 Пятёрочка");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://ai.api.cloud.yandex.net/v1/chat/completions",
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Api-Key secret" }) }),
    );
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(String(request.body));
    expect(body.model).toBe("gpt://folder/deepseek-v4.1-flash");
    expect(body.reasoning_effort).toBe("none");
    const imagePart = body.messages[0].content.find((part: { type: string }) => part.type === "image_url");
    expect(imagePart.image_url.url).toBe(
      `data:image/jpeg;base64,${Buffer.from("fake-jpeg-bytes").toString("base64")}`,
    );
  });

  it("throws a 400 when the model can't find an amount and merchant", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: "не найдено" } }] }), {
        status: 200,
      }),
    );

    await expect(
      new ReceiptVisionService(configWith(CONFIGURED)).describe(Buffer.from("x"), "image/jpeg"),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("is unavailable without a configured vision model, even with an API key", async () => {
    const fetchMock = jest.spyOn(global, "fetch");

    await expect(
      new ReceiptVisionService(
        configWith({ ...CONFIGURED, DEEPSEEK_VISION_MODEL: undefined }),
      ).describe(Buffer.from("x"), "image/jpeg"),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("wraps a provider failure as a retryable-sounding service error", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(new Response("", { status: 503 }));

    await expect(
      new ReceiptVisionService(configWith(CONFIGURED)).describe(Buffer.from("x"), "image/jpeg"),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
