import { Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";

import { DeepSeekProvider } from "./deepseek.provider";
import { GigaChatProvider } from "./gigachat.provider";
import type { LlmMessage, LlmResponse } from "./llm-provider";
import { LlmProviderError } from "./llm-provider";

@Injectable()
export class LlmRouterService {
  private readonly logger = new Logger(LlmRouterService.name);
  constructor(
    private readonly primary: DeepSeekProvider,
    private readonly fallback: GigaChatProvider,
  ) {}

  available(): boolean {
    return this.primary.configured() || this.fallback.configured();
  }

  async chat(messages: LlmMessage[]): Promise<LlmResponse> {
    try {
      if (!this.primary.configured()) throw new LlmProviderError("primary unavailable", 503, true);
      const response = await this.primary.chat(messages);
      this.logMetrics(response, false);
      return response;
    } catch (error) {
      const failure = error instanceof LlmProviderError ? error : null;
      if (!failure?.retryable || !this.fallback.configured())
        throw new ServiceUnavailableException("Amola Assistant временно недоступен");
      const response = await this.fallback.chat(messages);
      this.logMetrics(response, true);
      return response;
    }
  }

  private logMetrics(response: LlmResponse, fallback: boolean): void {
    this.logger.log(JSON.stringify({
      type: "assistant_provider_call",
      provider: response.provider,
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens,
      latencyMs: response.latencyMs,
      fallbackCount: fallback ? 1 : 0,
    }));
  }
}

