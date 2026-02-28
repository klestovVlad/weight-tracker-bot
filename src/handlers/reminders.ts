import { Env } from "../types";
import { sendMessage } from "../telegram/api";
import { getTodayDate } from "../utils";
import { getAllUsers } from "../db/users";
import { getWeightForDate } from "../db/weights";

const REMINDER_TEXT = "⏰ Напоминалка: отметь вес 🙂\nМожно просто числом, например: 87.4";

export interface ReminderStats {
  sent: number;
  skipped: number;
  errors: number;
}

async function wasReminderSent(
  db: D1Database,
  userId: number,
  date: string
): Promise<boolean> {
  const result = await db
    .prepare("SELECT 1 FROM reminders_sent WHERE user_id = ? AND date = ?")
    .bind(userId, date)
    .first();
  return result !== null;
}

async function markReminderSent(
  db: D1Database,
  userId: number,
  date: string
): Promise<void> {
  await db
    .prepare(
      "INSERT INTO reminders_sent (user_id, date, sent_at) VALUES (?, ?, datetime('now'))"
    )
    .bind(userId, date)
    .run();
}

export async function runReminders(env: Env): Promise<ReminderStats> {
  const stats: ReminderStats = { sent: 0, skipped: 0, errors: 0 };
  const today = getTodayDate();

  const users = await getAllUsers(env.DB);

  for (const user of users) {
    try {
      const weightToday = await getWeightForDate(env.DB, user.user_id, today);
      if (weightToday) {
        stats.skipped++;
        continue;
      }

      const alreadySent = await wasReminderSent(env.DB, user.user_id, today);
      if (alreadySent) {
        stats.skipped++;
        continue;
      }

      const response = await sendMessage(
        env.TELEGRAM_BOT_TOKEN,
        user.user_id,
        REMINDER_TEXT,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "✅ Внести вес", callback_data: "menu_enter_weight" }]
            ]
          }
        }
      );

      const result = await response.json() as { ok: boolean };

      if (result.ok) {
        await markReminderSent(env.DB, user.user_id, today);
        stats.sent++;
      } else {
        stats.errors++;
      }
    } catch (error) {
      console.error(`Reminder error for user ${user.user_id}:`, error);
      stats.errors++;
    }
  }

  return stats;
}
