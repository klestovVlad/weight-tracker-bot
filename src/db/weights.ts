import { WeightRecord } from "../types";

export async function saveWeight(
  db: D1Database,
  userId: number,
  date: string,
  weightKg: number
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO weights (user_id, date, weight_kg, created_at, updated_at)
       VALUES (?, ?, ?, datetime('now'), datetime('now'))
       ON CONFLICT(user_id, date) DO UPDATE SET
         weight_kg = excluded.weight_kg,
         updated_at = datetime('now')`
    )
    .bind(userId, date, weightKg)
    .run();
}

export async function getLastWeight(
  db: D1Database,
  userId: number
): Promise<WeightRecord | null> {
  return db
    .prepare(
      `SELECT * FROM weights
       WHERE user_id = ?
       ORDER BY date DESC
       LIMIT 1`
    )
    .bind(userId)
    .first<WeightRecord>();
}

export async function getLastWeightByUpdatedAt(
  db: D1Database,
  userId: number
): Promise<WeightRecord | null> {
  return db
    .prepare(
      `SELECT * FROM weights
       WHERE user_id = ?
       ORDER BY updated_at DESC
       LIMIT 1`
    )
    .bind(userId)
    .first<WeightRecord>();
}

export async function getPreviousWeight(
  db: D1Database,
  userId: number,
  beforeDate: string
): Promise<WeightRecord | null> {
  return db
    .prepare(
      `SELECT * FROM weights
       WHERE user_id = ? AND date < ?
       ORDER BY date DESC
       LIMIT 1`
    )
    .bind(userId, beforeDate)
    .first<WeightRecord>();
}

export async function updateWeightEntry(
  db: D1Database,
  recordId: number,
  userId: number,
  newWeightKg: number
): Promise<void> {
  await db
    .prepare(
      `UPDATE weights
       SET weight_kg = ?, updated_at = datetime('now')
       WHERE id = ? AND user_id = ?`
    )
    .bind(newWeightKg, recordId, userId)
    .run();
}

export async function getWeightHistory(
  db: D1Database,
  userId: number,
  limit: number
): Promise<WeightRecord[]> {
  const result = await db
    .prepare(
      `SELECT * FROM weights
       WHERE user_id = ?
       ORDER BY date DESC
       LIMIT ?`
    )
    .bind(userId, limit)
    .all<WeightRecord>();

  return result.results ?? [];
}
