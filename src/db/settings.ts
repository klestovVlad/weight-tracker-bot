export async function getSetting(db: D1Database, key: string): Promise<string | null> {
  const result = await db
    .prepare("SELECT value FROM settings WHERE key = ?")
    .bind(key)
    .first<{ value: string }>();

  return result?.value ?? null;
}

export async function setSetting(db: D1Database, key: string, value: string): Promise<void> {
  await db
    .prepare(
      `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    )
    .bind(key, value)
    .run();
}

const CROWN_USER_ID_KEY = "crown_user_id";

export async function getCrownUserId(db: D1Database): Promise<number | null> {
  const raw = await getSetting(db, CROWN_USER_ID_KEY);
  if (raw == null || raw === "") return null;
  const n = parseInt(raw, 10);
  return Number.isNaN(n) ? null : n;
}

export async function setCrownUserId(db: D1Database, userId: number | null): Promise<void> {
  await setSetting(db, CROWN_USER_ID_KEY, userId != null ? String(userId) : "");
}
