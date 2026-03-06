import type { Env } from "../types";
import { logError } from "./logging";

const TIMEOUT_MS = 180000; // 3 min — image gen can be slow

export interface GetStickerImageOptions {
  /** When true, return { error: string } on failure instead of null (for admin debug). */
  returnError?: boolean;
}

/** Result when API returns image as base64; we parse b64_json from the response for stable handling. */
export interface StickerImageB64 {
  b64: string;
}

type StickerReaction =
  | "huge_win"
  | "good_progress"
  | "small_win"
  | "neutral"
  | "oops"
  | "disaster";

function getStickerReaction(sumKg: number): StickerReaction {
  if (sumKg <= -3) return "huge_win";
  if (sumKg <= -1) return "good_progress";
  if (sumKg < 0) return "small_win";
  if (sumKg === 0) return "neutral";
  if (sumKg <= 1) return "oops";
  return "disaster";
}

const crocodileReactions: Record<StickerReaction, string[]> = {
  huge_win: [
    "celebrating wildly with arms raised",
    "jumping with victory",
    "wearing a crown and cheering",
    "flexing muscles proudly",
  ],

  good_progress: [
    "lifting dumbbells proudly",
    "showing thumbs up",
    "running confidently",
    "standing proud on a scale",
  ],

  small_win: [
    "smiling with relief",
    "wiping sweat after workout",
    "sitting tired but happy",
  ],

  neutral: [
    "shrugging confused",
    "checking the scale carefully",
    "thinking with a skeptical face",
  ],

  oops: [
    "guiltily eating a burger",
    "hiding fries behind back",
    "facepalm reaction",
  ],

  disaster: [
    "lying on the floor exhausted",
    "crying dramatically",
    "holding empty snack wrappers",
  ],
};

const reactionLabels: Record<StickerReaction, string> = {
  huge_win: "a huge victory celebration",
  good_progress: "proud good progress",
  small_win: "a small but pleasant win",
  neutral: "uncertain neutral mood",
  oops: "a light guilty oops reaction",
  disaster: "a dramatic total disaster",
};

const captionStyles = [
  "comic speech bubble",
  "bold ribbon banner",
  "handheld cardboard sign",
  "sport scoreboard panel",
  "victory medal badge",
  "comic explosion bubble",
  "sticker caption below character",
];

/**
 * Generates a Telegram sticker image with a crocodile mascot.
 * Uses OpenAI Images API.
 * Transparent background, one short Russian line with sumStr.
 * Returns URL string, or { b64 } for base64, or null on failure.
 */
export async function getStickerImageUrl(
  env: Env,
  _objectRu: string,
  sumKg: number,
  options?: GetStickerImageOptions,
): Promise<string | StickerImageB64 | { error: string } | null> {
  const returnError = options?.returnError ?? false;

  if (!env.OPENAI_API_KEY) {
    return returnError ? { error: "OPENAI_API_KEY не задан" } : null;
  }

  const sumStr = sumKg >= 0 ? `+${sumKg}` : String(sumKg);

  const reaction = getStickerReaction(sumKg);
  const poses = crocodileReactions[reaction];
  const pose = poses[Math.floor(Math.random() * poses.length)];

  const captionStyle =
    captionStyles[Math.floor(Math.random() * captionStyles.length)];

  const caption = `КОМАНДА ${sumStr} КГ`;

  const prompt = `
Telegram sticker, PNG.

Transparent background.
Square composition.

CHARACTER
A slightly chubby green cartoon crocodile mascot.
Always the same crocodile design.

STYLE
telegram sticker pack style
thick white outline
flat colors
bold shapes
clean cartoon style
memey reaction sticker

POSE
The crocodile is ${pose}.

EMOTION
Overall mood: ${reactionLabels[reaction]}.

CAPTION
Add a short caption integrated into the sticker.
The caption must be EXACTLY:

"${caption}"

Caption style:
${captionStyle}

Rules:
large bold lettering
one line only
Russian only
do not add extra words

GENERAL RULES
no cigarettes
no money
no logos
no watermark
no background scene
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

