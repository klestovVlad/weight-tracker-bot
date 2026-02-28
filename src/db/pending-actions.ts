import { PendingAction } from "../types";

export async function getPendingAction(
  db: D1Database,
  userId: number
): Promise<PendingAction | null> {
  return db
    .prepare("SELECT * FROM pending_actions WHERE user_id = ?")
    .bind(userId)
    .first<PendingAction>();
}

export async function upsertPendingAction(
  db: D1Database,
  userId: number,
  action: string
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO pending_actions (user_id, action, created_at)
       VALUES (?, ?, datetime('now'))
       ON CONFLICT(user_id) DO UPDATE SET
         action = excluded.action,
         created_at = datetime('now')`
    )
    .bind(userId, action)
    .run();
}

export async function clearPendingAction(db: D1Database, userId: number): Promise<void> {
  await db
    .prepare("DELETE FROM pending_actions WHERE user_id = ?")
    .bind(userId)
    .run();
}
