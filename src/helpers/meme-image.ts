import type { Env } from "../types";
import { logError } from "./logging";

const TIMEOUT_MS = 180000; // 3 min — image gen can be slow

export interface GetMemeImageOptions {
  /** When true, return { error: string } on failure instead of null (for admin debug). */
  returnError?: boolean;
}

/** Result when API returns image as base64 (GPT image models return b64_json, not url). */
export interface MemeImageB64 {
  b64: string;
}

/**
 * Generates a meme-style image for the given object (e.g. "пара зимних сапог").
 * sumKg = team total weight change (e.g. -1.9). Used in the prompt for context.
 * Uses OpenAI Images API (gpt-image-1 returns b64_json; DALL-E 2/3 can return url).
 * Returns URL string, or { b64 } for base64 image, or null on failure.
 * With options.returnError: true, returns { error: string } on failure for debugging.
 */
export async function getMemeImageUrl(
  env: Env,
  objectRu: string,
  sumKg: number,
  options?: GetMemeImageOptions,
): Promise<string | MemeImageB64 | { error: string } | null> {
  const returnError = options?.returnError ?? false;

  if (!env.OPENAI_API_KEY) {
    return returnError ? { error: "OPENAI_API_KEY не задан" } : null;
  }

  // Short prompt: DALL-E 2 works better without text on image and without sensitive words.
  const sumStr = sumKg >= 0 ? `+${sumKg}` : String(sumKg);
  const prompt = `
  Create a FUNNY motivational meme poster for a Telegram weight loss group.
  
  LANGUAGE: All visible text must be Russian.
  
  LAYOUT:
  - Bright gradient or neon background.
  - In the center: a cute or funny illustration of ${objectRu}.
  - Big bold headline at top:
    "Команда: ${sumStr} кг за неделю!"
  - Funny meme caption under it about comparing weight to ${objectRu}.
    Example tone: playful, absurd but friendly.
  - Small footer text:
    "Маленькие шаги — большие минусы 💪"
  
  STYLE:
  - Instagram / Telegram meme style.
  - Bold sans-serif typography.
  - Clean modern layout.
  - High contrast.
  - Not childish clipart, not photorealistic.
  - Looks like a shareable social media meme.
  
  HUMOR:
  - Be creative and unexpected.
  - Jokes about everyday life, food, objects, cats, winter, laziness, motivation.
  - Friendly humor only, no insults, no body shaming.
  
  VARIATION:
  Each image must look different:
  - random colors
  - different composition
  - different funny caption
  - different illustration pose
  
  RULES:
  - Only one main object: ${objectRu}.
  - No people.
  - No extra random text.
  - No English text.
  - No weight numbers except ${sumStr}.
  
  QUALITY:
  High quality illustration, modern poster, balanced composition.
  `;

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
        body: JSON.stringify({
          model: "gpt-image-1",
          prompt,
          size: "1024x1024",
          // keep cost reasonable; bump to "high" only if you really want
          quality: "medium",
          // optional: prefer png if supported by your current response parsing
          // response_format: "b64_json",
        }),
        signal: controller.signal,
      },
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      const body = await response.text();
      const detail = body
        ? `${response.status}: ${body}`
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
