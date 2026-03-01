import type { Env } from "../types";
import { logError } from "./logging";

const TIMEOUT_MS = 15000;

/**
 * Generates a meme-style image for the given object (e.g. "пара зимних сапог").
 * sumKg = team total weight change (e.g. -1.9). Used in the prompt for context.
 * Uses OpenAI Images API (DALL-E 2). Returns URL or null on failure.
 */
export async function getMemeImageUrl(
  env: Env,
  objectRu: string,
  sumKg: number,
): Promise<string | null> {
  if (!env.OPENAI_API_KEY) return null;

  const sumStr = sumKg >= 0 ? `+${sumKg}` : String(sumKg);
  const prompt = `
  Create a FUNNY motivational meme poster for a Telegram weight loss group.
  
  LANGUAGE: All visible text must be Russian.
  
  LAYOUT:
  - Bright gradient or neon background.
  - In the center: a cute or funny illustration of ${objectRu}.
  - Big bold headline at top:
    "Команда: ${sumKg} кг за неделю!"
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
  - No weight numbers except ${sumKg}.
  
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
          model: "dall-e-2",
          prompt,
          n: 1,
          size: "256x256",
        }),
        signal: controller.signal,
      },
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      logError(`OpenAI Images API error: ${response.status}`);
      return null;
    }

    const data = (await response.json()) as { data?: Array<{ url?: string }> };
    const url = data.data?.[0]?.url;
    return typeof url === "string" ? url : null;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      logError("OpenAI image request timed out");
    } else {
      logError("OpenAI image error", error);
    }
    return null;
  }
}
