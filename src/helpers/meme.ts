import type { GptMeme } from "../types";

/** Russian letters, spaces, hyphen. No digits, no person names. */
const OBJECT_REGEX = /^[а-яёА-ЯЁ\s\-]{2,60}$/;

/**
 * Validates GPT-returned meme object. Returns sanitized meme or null if invalid.
 */
export function validateGptMeme(meme: unknown): GptMeme | null {
  if (!meme || typeof meme !== "object") return null;
  const m = meme as Record<string, unknown>;
  const object = m.object;
  if (typeof object !== "string") return null;
  const trimmed = object.trim();
  if (trimmed.length < 2 || trimmed.length > 60) return null;
  if (!OBJECT_REGEX.test(trimmed)) return null;

  let emoji: string | undefined;
  if (m.emoji != null) {
    if (typeof m.emoji !== "string") return null;
    const e = m.emoji.trim();
    if (e.length > 12) return null;
    emoji = e || undefined;
  }

  let caption: string | undefined;
  if (m.caption != null) {
    if (typeof m.caption !== "string") return null;
    const c = m.caption.trim();
    if (c.length > 140) return null;
    if (/\d/.test(c)) return null;
    caption = c || undefined;
  }

  return { object: trimmed, emoji, caption };
}

const FALLBACK_OBJECTS_LOSS = [
  "пара зимних сапог",
  "средний арбуз",
  "два литра молока",
  "ноутбук с зарядкой",
  "небольшая кошка",
  "средняя тыква",
  "упаковка стирального порошка",
];

const FALLBACK_OBJECTS_GAIN = [
  "упаковка сливочного масла",
  "банка Nutella",
  "пара кроссовок",
  "толстая книга",
  "поллитра мороженого",
  "пачка пельменей",
  "бутылка вина",
];

/**
 * Deterministic fallback object for team sum comparison when GPT meme is missing/invalid.
 */
export function pickMemeObject(sumDayDelta: number): string {
  const abs = Math.abs(sumDayDelta);
  const index = Math.floor(abs * 10) % 7;
  if (sumDayDelta <= 0) {
    return FALLBACK_OBJECTS_LOSS[index] ?? FALLBACK_OBJECTS_LOSS[0];
  }
  return FALLBACK_OBJECTS_GAIN[index] ?? FALLBACK_OBJECTS_GAIN[0];
}
