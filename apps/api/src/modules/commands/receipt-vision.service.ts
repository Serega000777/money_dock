import { BadRequestException, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import type { Env } from "../../config/env";

/** Directive, and asks for the exact phrasing the deterministic command parser already
 * understands ("<amount> <merchant/category>") so a receipt photo reuses the same
 * CommandsService.parse pipeline as typed or spoken input — no separate draft shape to
 * maintain for this one input method. */
const PROMPT =
  "This is a photo of a Russian retail or restaurant receipt (or a screenshot of a bank " +
  "payment confirmation). Find the total amount paid and the merchant name. Reply with " +
  "exactly one short line in Russian in the form '<amount> <merchant>' (for example " +
  "'540 Пятёрочка'), nothing else — no currency sign, no quotes, no explanation. Use the " +
  "receipt's final/total amount, not a subtotal or a single item's price. If you cannot " +
  "find both an amount and a merchant name, reply with exactly: не найдено.";

const VISION_TIMEOUT_MS = 30_000;

interface VisionChatResponse {
  choices?: { message?: { content?: string } }[];
}

/** Receipt-photo capture (Shortcuts "photo" mode, and later the home screen's "Скан
 * чека"): turns a photo into the same short phrase a user would type or say, then
 * CommandsService.capture runs it through the existing text parser unchanged. */
@Injectable()
export class ReceiptVisionService {
  constructor(private readonly config: ConfigService<Env, true>) {}

  async describe(image: Buffer, mimeType: string): Promise<string> {
    const apiKey = this.config.get("DEEPSEEK_API_KEY", { infer: true });
    const model = this.config.get("DEEPSEEK_VISION_MODEL", { infer: true });
    if (!apiKey || !model) {
      throw new ServiceUnavailableException("Распознавание чеков сейчас недоступно");
    }
    const baseUrl = this.config.get("DEEPSEEK_BASE_URL", { infer: true }).replace(/\/$/, "");
    const authScheme = this.config.get("DEEPSEEK_AUTH_SCHEME", { infer: true });
    const normalizedMime = mimeType.split(";", 1)[0]?.trim() || "image/jpeg";

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), VISION_TIMEOUT_MS);
    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `${authScheme === "api-key" ? "Api-Key" : "Bearer"} ${apiKey}`,
          "Content-Type": "application/json",
        },
        signal: controller.signal,
        body: JSON.stringify({
          model,
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: PROMPT },
                {
                  type: "image_url",
                  image_url: { url: `data:${normalizedMime};base64,${image.toString("base64")}` },
                },
              ],
            },
          ],
          temperature: 0,
          max_tokens: 60,
          ...(baseUrl.includes("yandex.net") ? { reasoning_effort: "none" } : {}),
        }),
      });
      if (!response.ok) {
        throw new ServiceUnavailableException("Не удалось распознать чек. Попробуйте ещё раз");
      }
      const body = (await response.json()) as VisionChatResponse;
      const text = body.choices?.[0]?.message?.content?.trim() ?? "";
      if (!text || text.toLowerCase().includes("не найдено")) {
        throw new BadRequestException("Не удалось найти сумму и магазин на фото чека");
      }
      return text;
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof ServiceUnavailableException)
        throw error;
      throw new ServiceUnavailableException("Не удалось распознать чек. Попробуйте ещё раз");
    } finally {
      clearTimeout(timeout);
    }
  }
}
