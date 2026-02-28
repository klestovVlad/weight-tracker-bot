const WINDOW_MS = 2 * 60 * 1000;
const MAX_REQUESTS = 6;

export async function checkRateLimit(
  db: D1Database,
  userId: number,
  key: string
): Promise<boolean> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - WINDOW_MS).toISOString();

  const existing = await db
    .prepare(
      `SELECT window_start, count FROM rate_limits
       WHERE user_id = ? AND key = ?`
    )
    .bind(userId, key)
    .first<{ window_start: string; count: number }>();

  if (!existing) {
    await db
      .prepare(
        `INSERT INTO rate_limits (user_id, key, window_start, count)
         VALUES (?, ?, ?, 1)`
      )
      .bind(userId, key, now.toISOString())
      .run();
    return true;
  }

  const existingWindowStart = new Date(existing.window_start);
  
  if (existingWindowStart.getTime() < new Date(windowStart).getTime()) {
    await db
      .prepare(
        `UPDATE rate_limits SET window_start = ?, count = 1
         WHERE user_id = ? AND key = ?`
      )
      .bind(now.toISOString(), userId, key)
      .run();
    return true;
  }

  if (existing.count >= MAX_REQUESTS) {
    return false;
  }

  await db
    .prepare(
      `UPDATE rate_limits SET count = count + 1
       WHERE user_id = ? AND key = ?`
    )
    .bind(userId, key)
    .run();

  return true;
}
