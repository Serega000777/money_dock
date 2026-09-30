import { randomUUID } from "node:crypto";

import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import type { Env } from "../../../config/env";
import type { LlmMessage, LlmProvider, LlmResponse } from "./llm-provider";
import { LlmProviderError } from "./llm-provider";

interface GigaTokenResponse { access_token?: string; expires_at?: number }
interface GigaChatResponse {
  choices?: Array<{ message?: { content?: string } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

@Injectable()
export class GigaChatProvider implements LlmProvider {
  readonly name = "gigachat";
  private token: { value: string; expiresAt: number } | null = null;

  constructor(private readonly config: ConfigService<Env, true>) {}

  configured(): boolean {
    return Boolean(this.config.get("GIGACHAT_AUTHORIZATION_KEY", { infer: true }));
  }

  async chat(messages: LlmMessage[]): Promise<LlmResponse> {
    const startedAt = Date.now();
    const token = await this.accessToken();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25_000);
    try {
      const response = await fetch("https://api.giga.chat/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          model: this.config.get("GIGACHAT_MODEL", { infer: true }),
          messages,
          temperature: 0,
          max_tokens: 500,
        }),
      });
      if (!response.ok)
        throw new LlmProviderError(
          `GigaChat HTTP ${response.status}`,
          response.status,
          response.status === 429 || response.status >= 500,
        );
      const body = (await response.json()) as GigaChatResponse;
      const content = body.choices?.[0]?.message?.content?.trim();
      if (!content) throw new LlmProviderError("GigaChat returned no content", 502, true);
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

  private async accessToken(): Promise<string> {
    if (this.token && this.token.expiresAt > Date.now() + 60_000) return this.token.value;
    const authorizationKey = this.config.get("GIGACHAT_AUTHORIZATION_KEY", { infer: true });
    if (!authorizationKey) throw new LlmProviderError("GigaChat is not configured", 503, true);
    const body = new URLSearchParams({ scope: this.config.get("GIGACHAT_SCOPE", { infer: true }) });
    const response = await fetch("https://ngw.devices.sberbank.ru:9443/api/v2/oauth", {
      method: "POST",
      headers: {
        Authorization: `Basic ${authorizationKey}`,
        RqUID: randomUUID(),
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body,
    });
    if (!response.ok)
      throw new LlmProviderError(
        `GigaChat OAuth HTTP ${response.status}`,
        response.status,
        response.status === 429 || response.status >= 500,
      );
    const token = (await response.json()) as GigaTokenResponse;
    if (!token.access_token) throw new LlmProviderError("GigaChat OAuth returned no token", 502, true);
    const rawExpiresAt = token.expires_at ?? Date.now() + 25 * 60_000;
    // OAuth deployments have returned both Unix seconds and Unix milliseconds.
    // Normalize either representation so a valid token is actually reused.
    const expiresAt = rawExpiresAt < 10_000_000_000 ? rawExpiresAt * 1000 : rawExpiresAt;
    this.token = { value: token.access_token, expiresAt };
    return this.token.value;
  }
}
