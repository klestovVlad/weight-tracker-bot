import { WeightRecord } from "../types";
import { getPreviousDay } from "../utils";

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

export async function deleteWeight(
  db: D1Database,
  userId: number,
  date: string
): Promise<boolean> {
  const result = await db
    .prepare("DELETE FROM weights WHERE user_id = ? AND date = ?")
    .bind(userId, date)
    .run();

  return (result.meta?.changes ?? 0) > 0;
}

export interface UserStreak {
  length: number;
  lastDate: string;
}

/** Consecutive days with weight entries ending at user's last entry date (day-to-day in calendar). */
export async function getUserStreak(
  db: D1Database,
  userId: number
): Promise<UserStreak | null> {
  const result = await db
    .prepare(
      `SELECT date FROM weights WHERE user_id = ? ORDER BY date DESC LIMIT 200`
    )
    .bind(userId)
    .all<{ date: string }>();

  const dates = result.results ?? [];
  if (dates.length === 0) return null;

  const dateSet = new Set(dates.map((r) => r.date));
  const lastDate = dates[0].date;
  let length = 1;
  let current = lastDate;

  for (;;) {
    const prev = getPreviousDay(current);
    if (!dateSet.has(prev)) break;
    length++;
    current = prev;
  }

  return { length, lastDate };
}

/** Max user_id count per IN clause to stay under SQLite bind limit. */
const BATCH_CHUNK_SIZE = 100;

function chunkIds(ids: number[]): number[][] {
  const out: number[][] = [];
  for (let i = 0; i < ids.length; i += BATCH_CHUNK_SIZE) {
    out.push(ids.slice(i, i + BATCH_CHUNK_SIZE));
  }
  return out;
}

/** Weights for a single date, keyed by user_id. For daily report (today). */
export async function getWeightsForDateByUsers(
  db: D1Database,
  date: string,
  userIds: number[]
): Promise<Map<number, WeightRecord>> {
  const map = new Map<number, WeightRecord>();
  if (userIds.length === 0) return map;
  for (const chunk of chunkIds(userIds)) {
    const placeholders = chunk.map(() => "?").join(",");
    const result = await db
      .prepare(
        `SELECT * FROM weights WHERE user_id IN (${placeholders}) AND date = ?`
      )
      .bind(...chunk, date)
      .all<WeightRecord>();
    for (const row of result.results ?? []) {
      map.set(row.user_id, row);
    }
  }
  return map;
}

/** Latest weight strictly before date, per user. For daily (previous day) and weekly (before week). */
export async function getPreviousWeightsByUsers(
  db: D1Database,
  beforeDate: string,
  userIds: number[]
): Promise<Map<number, WeightRecord>> {
  const map = new Map<number, WeightRecord>();
  if (userIds.length === 0) return map;
  for (const chunk of chunkIds(userIds)) {
    const placeholders = chunk.map(() => "?").join(",");
    const result = await db
      .prepare(
        `SELECT w.* FROM weights w
         INNER JOIN (
           SELECT user_id, MAX(date) as max_date
           FROM weights
           WHERE user_id IN (${placeholders}) AND date < ?
           GROUP BY user_id
         ) t ON w.user_id = t.user_id AND w.date = t.max_date`
      )
      .bind(...chunk, beforeDate)
      .all<WeightRecord>();
    for (const row of result.results ?? []) {
      map.set(row.user_id, row);
    }
  }
  return map;
}

/** Latest weight on or before date, per user. For weekly/monthly end-of-period. */
export async function getWeightsOnOrBeforeDateByUsers(
  db: D1Database,
  date: string,
  userIds: number[]
): Promise<Map<number, WeightRecord>> {
  const map = new Map<number, WeightRecord>();
  if (userIds.length === 0) return map;
  for (const chunk of chunkIds(userIds)) {
    const placeholders = chunk.map(() => "?").join(",");
    const result = await db
      .prepare(
        `SELECT w.* FROM weights w
         INNER JOIN (
           SELECT user_id, MAX(date) as max_date
           FROM weights
           WHERE user_id IN (${placeholders}) AND date <= ?
           GROUP BY user_id
         ) t ON w.user_id = t.user_id AND w.date = t.max_date`
      )
      .bind(...chunk, date)
      .all<WeightRecord>();
    for (const row of result.results ?? []) {
      map.set(row.user_id, row);
    }
  }
  return map;
}

/** First (earliest) weight within [startDate, endDate] per user. For monthly report. */
export async function getFirstWeightInRangeByUsers(
  db: D1Database,
  startDate: string,
  endDate: string,
  userIds: number[]
): Promise<Map<number, WeightRecord>> {
  const map = new Map<number, WeightRecord>();
  if (userIds.length === 0) return map;
  for (const chunk of chunkIds(userIds)) {
    const placeholders = chunk.map(() => "?").join(",");
    const result = await db
      .prepare(
        `SELECT w.* FROM weights w
         INNER JOIN (
           SELECT user_id, MIN(date) as min_date
           FROM weights
           WHERE user_id IN (${placeholders}) AND date >= ? AND date <= ?
           GROUP BY user_id
         ) t ON w.user_id = t.user_id AND w.date = t.min_date`
      )
      .bind(...chunk, startDate, endDate)
      .all<WeightRecord>();
    for (const row of result.results ?? []) {
      map.set(row.user_id, row);
    }
  }
  return map;
}

/** Last (latest) weight within [startDate, endDate] per user. For weekly/monthly report. */
export async function getLastWeightInRangeByUsers(
  db: D1Database,
  startDate: string,
  endDate: string,
  userIds: number[]
): Promise<Map<number, WeightRecord>> {
  const map = new Map<number, WeightRecord>();
  if (userIds.length === 0) return map;
  for (const chunk of chunkIds(userIds)) {
    const placeholders = chunk.map(() => "?").join(",");
    const result = await db
      .prepare(
        `SELECT w.* FROM weights w
         INNER JOIN (
           SELECT user_id, MAX(date) as max_date
           FROM weights
           WHERE user_id IN (${placeholders}) AND date >= ? AND date <= ?
           GROUP BY user_id
         ) t ON w.user_id = t.user_id AND w.date = t.max_date`
      )
      .bind(...chunk, startDate, endDate)
      .all<WeightRecord>();
    for (const row of result.results ?? []) {
      map.set(row.user_id, row);
    }
  }
  return map;
}

export async function getOverallFirstAndLastByUsers(
  db: D1Database,
  userIds: number[]
): Promise<Map<number, OverallStats>> {
  const map = new Map<number, OverallStats>();
  if (userIds.length === 0) return map;
  for (const chunk of chunkIds(userIds)) {
    const placeholders = chunk.map(() => "?").join(",");
    const statsResult = await db
      .prepare(
        `SELECT user_id, MIN(date) as first_date, MAX(date) as last_date, COUNT(*) as total_entries
         FROM weights
         WHERE user_id IN (${placeholders})
         GROUP BY user_id`
      )
      .bind(...chunk)
      .all<{
        user_id: number;
        first_date: string;
        last_date: string;
        total_entries: number;
      }>();

    const stats = statsResult.results ?? [];
    if (stats.length === 0) continue;

    const firstOrClauses = stats
      .map(() => "(user_id = ? AND date = ?)")
      .join(" OR ");
    const firstBind = stats.flatMap((s) => [s.user_id, s.first_date]);
    const firstRows = await db
      .prepare(
        `SELECT user_id, weight_kg FROM weights WHERE ${firstOrClauses}`
      )
      .bind(...firstBind)
      .all<{ user_id: number; weight_kg: number }>();

    const lastOrClauses = stats
      .map(() => "(user_id = ? AND date = ?)")
      .join(" OR ");
    const lastBind = stats.flatMap((s) => [s.user_id, s.last_date]);
    const lastRows = await db
      .prepare(
        `SELECT user_id, weight_kg FROM weights WHERE ${lastOrClauses}`
      )
      .bind(...lastBind)
      .all<{ user_id: number; weight_kg: number }>();

    const firstMap = new Map(
      (firstRows.results ?? []).map((r) => [r.user_id, r.weight_kg])
    );
    const lastMap = new Map(
      (lastRows.results ?? []).map((r) => [r.user_id, r.weight_kg])
    );

    for (const s of stats) {
      const firstKg = firstMap.get(s.user_id);
      const lastKg = lastMap.get(s.user_id);
      if (firstKg != null && lastKg != null) {
        map.set(s.user_id, {
          firstDate: s.first_date,
          firstWeight: firstKg,
          lastDate: s.last_date,
          lastWeight: lastKg,
          totalEntries: s.total_entries,
        });
      }
    }
  }
  return map;
}

/** Streak length (consecutive days) per user. Fetches dates per user in one query per chunk, then computes in memory. */
export async function getUserStreakLengthsByUsers(
  db: D1Database,
  userIds: number[]
): Promise<Map<number, number>> {
  const map = new Map<number, number>();
  if (userIds.length === 0) return map;

  for (const chunk of chunkIds(userIds)) {
    const placeholders = chunk.map(() => "?").join(",");
    const result = await db
      .prepare(
        `SELECT user_id, date FROM weights
         WHERE user_id IN (${placeholders})
         ORDER BY user_id, date DESC`
      )
      .bind(...chunk)
      .all<{ user_id: number; date: string }>();

    const rows = result.results ?? [];
    const byUser = new Map<number, string[]>();
    for (const r of rows) {
      if (!byUser.has(r.user_id)) byUser.set(r.user_id, []);
      byUser.get(r.user_id)!.push(r.date);
    }

    for (const [uid, dates] of byUser) {
      const dateSet = new Set(dates);
      const lastDate = dates[0];
      let length = 1;
      let current = lastDate;
      for (;;) {
        const prev = getPreviousDay(current);
        if (!dateSet.has(prev)) break;
        length++;
        current = prev;
      }
      map.set(uid, length);
    }
  }
  return map;
}
