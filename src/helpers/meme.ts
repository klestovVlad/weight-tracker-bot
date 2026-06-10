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

/**
 * Buckets of everyday objects keyed by their approximate real-world weight.
 * Used so the meme/sticker analogy actually matches the team's kg change,
 * instead of picking a random object whose weight is unrelated.
 *
 * Food/items only — never animals (sticker generation rejects animals).
 * `maxKg` is the upper bound of the bucket; the first bucket whose `maxKg`
 * is >= the target weight wins.
 */
interface WeightBucket {
  maxKg: number;
  objects: string[];
}

const WEIGHT_BUCKETS: WeightBucket[] = [
  { maxKg: 0.5, objects: ["плитка шоколада", "банка газировки", "пачка масла", "пачка чипсов"] },
  { maxKg: 1, objects: ["пакет молока", "буханка хлеба", "бутылка вина", "банка Nutella"] },
  { maxKg: 1.5, objects: ["пара кроссовок", "ноутбук", "пакет сахара", "толстая книга"] },
  { maxKg: 2.5, objects: ["ананас", "чугунная сковорода", "пара зимних сапог", "кирпич"] },
  { maxKg: 4, objects: ["средняя тыква", "большой пакет муки", "пакет картошки", "стопка книг"] },
  { maxKg: 6, objects: ["большой арбуз", "гиря на пять кило", "мешок сахара", "ящик мандаринов"] },
  { maxKg: 8, objects: ["ведро воды", "системный блок", "малыш на руках", "набор гантелей"] },
  { maxKg: 12, objects: ["мешок картошки", "канистра воды", "гиря на десять кило", "ящик с инструментами"] },
  { maxKg: 18, objects: ["мешок цемента", "средний чемодан", "ящик пива", "колесо от машины"] },
  { maxKg: 28, objects: ["мешок картошки на двадцать пять кило", "велосипед", "стиральная машина", "большой чемодан в отпуск"] },
  { maxKg: Infinity, objects: ["холодильник", "мешок цемента на сорок кило", "офисный стол", "мотоцикл"] },
];

/** Returns the object pool for the bucket matching `kg` (absolute value). Exported for tests. */
export function bucketForWeight(kg: number): string[] {
  const abs = Math.abs(kg);
  const bucket = WEIGHT_BUCKETS.find((b) => abs <= b.maxKg) ?? WEIGHT_BUCKETS[WEIGHT_BUCKETS.length - 1];
  return bucket.objects;
}

/**
 * Picks a fallback comparison object whose real weight is close to `kg`.
 * Used when GPT omits or returns an invalid meme object. Rotates within the
 * matching weight bucket so the same object is not repeated every report.
 */
export function pickMemeObject(kg: number): string {
  const pool = bucketForWeight(kg);
  const index = Math.floor(Math.random() * pool.length);
  return pool[index] ?? pool[0];
}

/** Human-readable list of example objects near `kg`, for the GPT analogy prompt. */
export function analogyExamplesForWeight(kg: number): string {
  return bucketForWeight(kg).join(", ");
}
