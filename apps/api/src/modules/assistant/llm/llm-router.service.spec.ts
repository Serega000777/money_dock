import { ServiceUnavailableException } from "@nestjs/common";

import { LlmProviderError } from "./llm-provider";
import { LlmRouterService } from "./llm-router.service";

describe("LlmRouterService", () => {
  const messages = [{ role: "user" as const, content: "сложный запрос" }];

  it("uses DeepSeek only when the primary succeeds", async () => {
    const primary = {
      configured: () => true,
      chat: jest.fn().mockResolvedValue({ content: "{}", provider: "deepseek", latencyMs: 10 }),
    };
    const fallback = { configured: () => true, chat: jest.fn() };
    const router = new LlmRouterService(primary as never, fallback as never);
    await expect(router.chat(messages)).resolves.toMatchObject({ provider: "deepseek" });
    expect(fallback.chat).not.toHaveBeenCalled();
  });

  it("uses GigaChat only after a retryable provider failure", async () => {
    const primary = {
      configured: () => true,
      chat: jest.fn().mockRejectedValue(new LlmProviderError("quota", 429, true)),
    };
    const fallback = {
      configured: () => true,
      chat: jest.fn().mockResolvedValue({ content: "{}", provider: "gigachat", latencyMs: 12 }),
    };
    const router = new LlmRouterService(primary as never, fallback as never);
    await expect(router.chat(messages)).resolves.toMatchObject({ provider: "gigachat" });
    expect(fallback.chat).toHaveBeenCalledTimes(1);
  });

  it("does not fan a user/client error out to the fallback", async () => {
    const primary = {
      configured: () => true,
      chat: jest.fn().mockRejectedValue(new LlmProviderError("bad request", 400, false)),
    };
    const fallback = { configured: () => true, chat: jest.fn() };
    const router = new LlmRouterService(primary as never, fallback as never);
    await expect(router.chat(messages)).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(fallback.chat).not.toHaveBeenCalled();
  });
});

