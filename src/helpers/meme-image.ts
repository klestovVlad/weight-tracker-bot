import type { Env } from "../types";
import { logError } from "./logging";

const TIMEOUT_MS = 180000; // 3 min — image gen can be slow

export interface GetMemeImageOptions {
  /** When true, return { error: string } on failure instead of null (for admin debug). */
  returnError?: boolean;
}

/** Result when API returns image as base64; we parse b64_json from the response for stable handling. */
export interface MemeImageB64 {
  b64: string;
}

/**
 * Generates a Telegram sticker image. Uses OpenAI Images API.
 * Transparent background, one short Russian line with sumStr.
 * Returns URL string, or { b64 } for base64, or null on failure.
 */
export async function getMemeImageUrl(
  env: Env,
  _objectRu: string,
  sumKg: number,
  options?: GetMemeImageOptions,
): Promise<string | MemeImageB64 | { error: string } | null> {
  const returnError = options?.returnError ?? false;

  if (!env.OPENAI_API_KEY) {
    return returnError ? { error: "OPENAI_API_KEY не задан" } : null;
  }

  const sumStr = sumKg >= 0 ? `+${sumKg}` : String(sumKg);

  const prompt = `Telegram sticker.
Transparent background.
Single cute cartoon animal mascot.
Centered composition.

Style:
telegram sticker pack
thick black outline
flat colors
minimal details
clean shapes

Character:
happy meme animal celebrating victory.

Add one short Russian text line:

"КОМАНДА ${sumStr} КГ"

Large bold text.

No background.
No extra objects.
No logos.
No watermark.`;

  const body: Record<string, unknown> = {
    model: "gpt-image-1.5", // latest, best quality; alternatives: gpt-image-1, gpt-image-1-mini
    prompt: prompt.trim(),
    n: 1,
    size: "1024x1024",
    quality: "high",
    background: "transparent",
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(
      "https://api.openai.com/v1/images/generations",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      },
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      const bodyText = await response.text();
      const detail = bodyText
        ? `${response.status}: ${bodyText}`
        : String(response.status);
      logError(`OpenAI Images API error: ${detail}`);
      return returnError ? { error: detail } : null;
    }

    const data = (await response.json()) as {
      data?: Array<{ url?: string; b64_json?: string }>;
    };
    const first = data.data?.[0];
    const url = first?.url;
    const b64 = first?.b64_json;
    if (typeof url === "string") return url;
    if (typeof b64 === "string") return { b64 };
    return returnError ? { error: "В ответе нет url и нет b64_json" } : null;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      logError("OpenAI image request timed out");
      const timeoutSec = Math.round(TIMEOUT_MS / 1000);
      return returnError
        ? { error: `Таймаут (${timeoutSec} с). Сервер не успел сгенерировать изображение.` }
        : null;
    }
    const message = error instanceof Error ? error.message : String(error);
    logError("OpenAI image error", error);
    return returnError ? { error: message } : null;
  }
}
