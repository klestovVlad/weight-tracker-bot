export type WeighFrequency = "daily" | "weekly";

export interface UserSettings {
  user_id: number;
  vacation_until: string | null;
  weigh_frequency: WeighFrequency | null;
  created_at: string;
  updated_at: string;
}

export async function getUserSettings(
  db: D1Database,
  userId: number
): Promise<UserSettings | null> {
  return db
    .prepare("SELECT * FROM user_settings WHERE user_id = ?")
    .bind(userId)
    .first<UserSettings>();
}

export async function setVacationUntil(
  db: D1Database,
  userId: number,
  vacationUntil: string | null
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO user_settings (user_id, vacation_until, created_at, updated_at)
       VALUES (?, ?, datetime('now'), datetime('now'))
       ON CONFLICT(user_id) DO UPDATE SET
         vacation_until = excluded.vacation_until,
         updated_at = datetime('now')`
    )
    .bind(userId, vacationUntil)
    .run();
}

export async function getWeighFrequency(
  db: D1Database,
  userId: number
): Promise<WeighFrequency> {
  const settings = await getUserSettings(db, userId);
  const f = settings?.weigh_frequency;
  return f === "weekly" ? "weekly" : "daily";
}

export async function setWeighFrequency(
  db: D1Database,
  userId: number,
  frequency: WeighFrequency
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO user_settings (user_id, vacation_until, weigh_frequency, created_at, updated_at)
       VALUES (?, (SELECT vacation_until FROM user_settings WHERE user_id = ?), ?, datetime('now'), datetime('now'))
       ON CONFLICT(user_id) DO UPDATE SET
         weigh_frequency = excluded.weigh_frequency,
         updated_at = datetime('now')`
    )
    .bind(userId, userId, frequency)
    .run();
}


export async function clearVacation(
  db: D1Database,
  userId: number
): Promise<void> {
  await setVacationUntil(db, userId, null);
}

export async function isOnVacation(
  db: D1Database,
  userId: number,
  today: string
): Promise<boolean> {
  const settings = await getUserSettings(db, userId);
  if (!settings?.vacation_until) return false;
  return settings.vacation_until >= today;
}

export async function getUsersOnVacation(
  db: D1Database,
  today: string
): Promise<number[]> {
  const result = await db
    .prepare("SELECT user_id FROM user_settings WHERE vacation_until >= ?")
    .bind(today)
    .all<{ user_id: number }>();
  return (result.results ?? []).map(r => r.user_id);
}

/** Users who participate in the daily report (daily weigh-in frequency). */
export async function getUsersWithDailyFrequency(
  db: D1Database
): Promise<Array<{ user_id: number; display_name: string }>> {
  const result = await db
    .prepare(
      `SELECT u.user_id, u.display_name
       FROM users u
       LEFT JOIN user_settings s ON u.user_id = s.user_id
       WHERE COALESCE(s.weigh_frequency, 'daily') = 'daily'`
    )
    .all<{ user_id: number; display_name: string }>();
  return result.results ?? [];
}
