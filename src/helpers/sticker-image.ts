import type { Env } from "../types";
import { logError } from "./logging";
import { pickMemeObject } from "./meme";

const TIMEOUT_MS = 180000; // 3 min — image gen can be slow

export interface GetStickerImageOptions {
  /** When true, return { error: string } on failure instead of null (for admin debug). */
  returnError?: boolean;
}

/** Result when API returns image as base64; we parse b64_json from the response for stable handling. */
export interface StickerImageB64 {
  b64: string;
}

/** Normalize object string: strip sticker prefix, trim. */
function normalizeObjectInput(raw: string): string {
  let s = raw.trim();
  if (s.toLowerCase().startsWith("sticker:")) s = s.slice(8).trim();
  if (s.toLowerCase().startsWith("[sticker]")) s = s.slice(9).trim();
  return s;
}

/** Russian words for animals — object must not be an animal (food or item only). */
const ANIMAL_WORDS = new Set([
  "кошка", "кот", "котёнок", "котята", "собака", "пёс", "собаки", "щенок", "щенки",
  "мышь", "мыши", "хомяк", "хомяки", "птица", "птицы", "рыба", "рыбы", "корова", "коровы",
  "свинья", "свиньи", "лошадь", "лошади", "крокодил", "крокодилы", "заяц", "зайцы",
  "медведь", "медведи", "лиса", "лисы", "волк", "волки", "слон", "слоны", "обезьяна", "обезьяны",
  "попугай", "попугаи", "голубь", "голуби", "курица", "курицы", "утка", "утки", "гусь", "гуси",
  "кролик", "кролики", "крыса", "крысы", "змея", "змеи", "черепаха", "черепахи",
  "лягушка", "лягушки", "кит", "киты", "дельфин", "дельфины", "животное", "животные",
  "зверь", "звери", "пёсик", "котик", "котенок",
]);

function containsAnimalWord(text: string): boolean {
  const lower = text.toLowerCase().replace(/\s+/g, " ");
  const tokens = lower.split(/[\s\-]+/).filter(Boolean);
  return tokens.some((t) => ANIMAL_WORDS.has(t));
}

/**
 * Returns object text safe for the sticker: food or item only, never an animal.
 * When the requested object is missing or an animal, falls back to an object
 * whose real weight is close to `sumKg` so the analogy still matches the change.
 */
function getSafeStickerObject(objectRu: string, sumKg: number): string {
  const normalized = normalizeObjectInput(objectRu);
  if (!normalized || normalized.length < 2 || containsAnimalWord(normalized)) {
    return pickMemeObject(sumKg);
  }
  return normalized;
}

/**
 * Generates a Telegram sticker image: realistic crocodile holding an object (food/item) in its mouth.
 * Uses OpenAI Images API. Object is validated to be food or item only, not an animal.
 * Returns URL string, or { b64 } for base64, or null on failure.
 */
export async function getStickerImageUrl(
  env: Env,
  objectRu: string,
  sumKg: number,
  options?: GetStickerImageOptions,
): Promise<string | StickerImageB64 | { error: string } | null> {
  const returnError = options?.returnError ?? false;

  if (!env.OPENAI_API_KEY) {
    return returnError ? { error: "OPENAI_API_KEY не задан" } : null;
  }

  const sumStr = sumKg >= 0 ? `+${sumKg}` : String(sumKg);
  const objectText = getSafeStickerObject(objectRu, sumKg);

  const prompt = `
Telegram sticker. Transparent background. Square composition.

STYLE
Semi-realistic crocodile illustration. Photorealistic reptile skin texture. Natural crocodile colors and lighting. Not cartoon, not vector, not cute. The crocodile should look like a real animal photo, but formatted as a meme sticker.

CHARACTER
Large crocodile head with mouth wide open. Sharp realistic teeth. Detailed reptile scales. Pink mouth interior. Expression slightly funny or mischievous.

ACTION
The crocodile is holding ${objectText} in its mouth.

COMPOSITION
Top banner: "КОМАНДА ${sumStr} КГ"
Bottom banner: "ЭТО КАК ${objectText}!"
The object must be clearly visible in the mouth.

TEXT STYLE
Bold meme banner style. Yellow ribbon banners. Black bold text.

STICKER STYLE
White sticker outline around the whole composition.

DETAILS
Water drops near the mouth. Dynamic meme energy.

RULES
No cartoon crocodile. No mascot style. No people. No logos. Russian text only.
`.trim();

  const body: Record<string, unknown> = {
    model: "gpt-image-1.5", // latest, best quality; alternatives: gpt-image-1, gpt-image-1-mini
    prompt,
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
        ? {
            error: `Таймаут (${timeoutSec} с). Сервер не успел сгенерировать изображение.`,
          }
        : null;
    }
    const message = error instanceof Error ? error.message : String(error);
    logError("OpenAI image error", error);
    return returnError ? { error: message } : null;
  }
}

