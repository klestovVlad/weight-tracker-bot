import { TelegramUser } from "../types";
import { getDisplayName } from "../utils";

export async function ensureUser(db: D1Database, user: TelegramUser): Promise<void> {
  const displayName = getDisplayName(user);

  await db
    .prepare(
      `INSERT INTO users (user_id, display_name, username, created_at)
       VALUES (?, ?, ?, datetime('now'))
       ON CONFLICT(user_id) DO UPDATE SET
         display_name = excluded.display_name,
         username = excluded.username`
    )
    .bind(user.id, displayName, user.username ?? null)
    .run();
}

export async function getUserDisplayName(db: D1Database, userId: number): Promise<string> {
  const result = await db
    .prepare("SELECT display_name FROM users WHERE user_id = ?")
    .bind(userId)
    .first<{ display_name: string }>();

  return result?.display_name ?? "Unknown";
}
