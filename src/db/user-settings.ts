export interface UserSettings {
  user_id: number;
  vacation_until: string | null;
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
