import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import type { Env } from "../../../config/env";
import type { LlmMessage, LlmProvider, LlmResponse } from "./llm-provider";
import { LlmProviderError } from "./llm-provider";

interface DeepSeekResponse {
  choices?: Array<{ message?: { content?: string } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

@Injectable()
export class DeepSeekProvider implements LlmProvider {
  readonly name = "deepseek";
  constructor(private readonly config: ConfigService<Env, true>) {}

  configured(): boolean {
    return Boolean(this.config.get("DEEPSEEK_API_KEY", { infer: true }));
  }

  async chat(messages: LlmMessage[]): Promise<LlmResponse> {
    const key = this.config.get("DEEPSEEK_API_KEY", { infer: true });
    if (!key) throw new LlmProviderError("DeepSeek is not configured", 503, true);
    const startedAt = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25_000);
    try {
      const response = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          model: this.config.get("DEEPSEEK_MODEL", { infer: true }),
          messages,
          response_format: { type: "json_object" },
          thinking: { type: "disabled" },
          temperature: 0,
          max_tokens: 500,
        }),
      });
      if (!response.ok)
        throw new LlmProviderError(
          `DeepSeek HTTP ${response.status}`,
          response.status,
          response.status === 429 || response.status >= 500,
        );
      const body = (await response.json()) as DeepSeekResponse;
      const content = body.choices?.[0]?.message?.content?.trim();
      if (!content) throw new LlmProviderError("DeepSeek returned no content", 502, true);
      return {
        content,
        provider: this.name,
        inputTokens: body.usage?.prompt_tokens,
        outputTokens: body.usage?.completion_tokens,
        latencyMs: Date.now() - startedAt,
      };
    } catch (error) {
      if (error instanceof LlmProviderError) throw error;
      throw new LlmProviderError(error instanceof Error ? error.message : "network error", 503, true);
    } finally {
      clearTimeout(timeout);
    }
  }
}

