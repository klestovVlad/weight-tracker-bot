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

export interface OverallStats {
  firstDate: string;
  firstWeight: number;
  lastDate: string;
  lastWeight: number;
  totalEntries: number;
}

export async function getOverallFirstAndLast(
  db: D1Database,
  userId: number
): Promise<OverallStats | null> {
  const stats = await db
    .prepare(
      `SELECT 
        MIN(date) as first_date,
        MAX(date) as last_date,
        COUNT(*) as total_entries
       FROM weights
       WHERE user_id = ?`
    )
    .bind(userId)
    .first<{ first_date: string; last_date: string; total_entries: number }>();

  if (!stats || !stats.first_date || stats.total_entries < 1) {
    return null;
  }

  const firstRecord = await db
    .prepare("SELECT weight_kg FROM weights WHERE user_id = ? AND date = ?")
    .bind(userId, stats.first_date)
    .first<{ weight_kg: number }>();

  const lastRecord = await db
    .prepare("SELECT weight_kg FROM weights WHERE user_id = ? AND date = ?")
    .bind(userId, stats.last_date)
    .first<{ weight_kg: number }>();

  if (!firstRecord || !lastRecord) {
    return null;
  }

  return {
    firstDate: stats.first_date,
    firstWeight: firstRecord.weight_kg,
    lastDate: stats.last_date,
    lastWeight: lastRecord.weight_kg,
    totalEntries: stats.total_entries,
  };
}

export async function getWeightForDate(
  db: D1Database,
  userId: number,
  date: string
): Promise<WeightRecord | null> {
  return db
    .prepare("SELECT * FROM weights WHERE user_id = ? AND date = ?")
    .bind(userId, date)
    .first<WeightRecord>();
}

export interface UserWithWeight {
  user_id: number;
  display_name: string;
}

export async function getUsersWithWeightOnDate(
  db: D1Database,
  date: string
): Promise<UserWithWeight[]> {
  const result = await db
    .prepare(
      `SELECT DISTINCT w.user_id, u.display_name
       FROM weights w
       JOIN users u ON w.user_id = u.user_id
       WHERE w.date = ?`
    )
    .bind(date)
    .all<UserWithWeight>();

  return result.results ?? [];
}

export async function getUsersWithWeightInRange(
  db: D1Database,
  startDate: string,
  endDate: string
): Promise<UserWithWeight[]> {
  const result = await db
    .prepare(
      `SELECT DISTINCT w.user_id, u.display_name
       FROM weights w
       JOIN users u ON w.user_id = u.user_id
       WHERE w.date >= ? AND w.date <= ?`
    )
    .bind(startDate, endDate)
    .all<UserWithWeight>();

  return result.results ?? [];
}

export async function countUserEntriesInRange(
  db: D1Database,
  userId: number,
  startDate: string,
  endDate: string
): Promise<number> {
  const result = await db
    .prepare(
      `SELECT COUNT(*) as count
       FROM weights
       WHERE user_id = ? AND date >= ? AND date <= ?`
    )
    .bind(userId, startDate, endDate)
    .first<{ count: number }>();

  return result?.count ?? 0;
}

export async function getWeightOnOrBeforeDate(
  db: D1Database,
  userId: number,
  date: string
): Promise<WeightRecord | null> {
  return db
    .prepare(
      `SELECT * FROM weights
       WHERE user_id = ? AND date <= ?
       ORDER BY date DESC
       LIMIT 1`
    )
    .bind(userId, date)
    .first<WeightRecord>();
}
