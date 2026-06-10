import { Env } from "../types";
import { sendMessage } from "../telegram/api";
import { getTodayDate, isSunday, getStartOfWeek, getPreviousDay, getDaysBetween } from "../utils";
import { getAllUsers } from "../db/users";
import {
  getWeightForDate,
  countUserEntriesInRange,
  getUserStreak,
  getLastWeight,
} from "../db/weights";
import { getGoal, computeGoalProgress } from "../db/goals";
import { isOnVacation, getWeighFrequency, getReminderHour, type WeighFrequency } from "../db/user-settings";
import { logError } from "../helpers/logging";
import { RU } from "../i18n";
import { pickReminderKind, type ReminderContext } from "../helpers/reminder-text";

/** Maps a chosen reminder kind to its localized message. */
function reminderTextFor(
  ctx: ReminderContext & { frequency: WeighFrequency },
): string {
  switch (pickReminderKind(ctx)) {
    case "onboarding":
      return RU.reminder_onboarding;
    case "goal":
      return RU.reminder_goal((ctx.goalRemainingKg ?? 0).toFixed(1));
    case "streak":
      return RU.reminder_streak(ctx.streakAtRisk);
    case "comeback":
      return RU.reminder_comeback;
    default:
      return ctx.frequency === "weekly" ? RU.reminder_weekly : RU.reminder_daily;
  }
}

/** Gathers the personalization context for a user's reminder. */
async function buildReminderContext(
  env: Env,
  userId: number,
  frequency: WeighFrequency,
  today: string,
): Promise<ReminderContext> {
  const yesterday = getPreviousDay(today);
  const [streakInfo, last] = await Promise.all([
    getUserStreak(env.DB, userId),
    getLastWeight(env.DB, userId),
  ]);

  const streakAtRisk =
    streakInfo && streakInfo.lastDate === yesterday ? streakInfo.length : 0;
  const daysSinceLast = last ? getDaysBetween(last.date, today) : null;

  let goalRemainingKg: number | null = null;
  if (last) {
    const goal = await getGoal(env.DB, userId);
    if (goal) {
      const progress = computeGoalProgress(goal, last.weight_kg);
      goalRemainingKg = progress.reached ? null : progress.remainingKg;
    }
  }

  return { frequency, streakAtRisk, daysSinceLast, goalRemainingKg };
}

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

/**
 * Sends due reminders. When `hourFilter` is given (hourly cron), only users
 * whose personal reminder hour equals it are considered; when omitted (manual
 * debug run), hour is ignored.
 */
export async function runReminders(
  env: Env,
  hourFilter?: number,
): Promise<ReminderStats> {
  const stats: ReminderStats = { sent: 0, skipped: 0, errors: 0 };
  const today = getTodayDate();

  const users = await getAllUsers(env.DB);

  for (const user of users) {
    try {
      if (hourFilter !== undefined) {
        const hour = await getReminderHour(env.DB, user.user_id);
        if (hour !== hourFilter) {
          stats.skipped++;
          continue;
        }
      }

      const onVacation = await isOnVacation(env.DB, user.user_id, today);
      if (onVacation) {
        stats.skipped++;
        continue;
      }

      const frequency = await getWeighFrequency(env.DB, user.user_id);

      if (frequency === "weekly") {
        if (!isSunday(today)) {
          stats.skipped++;
          continue;
        }
        const startOfWeek = getStartOfWeek(today);
        const entriesThisWeek = await countUserEntriesInRange(
          env.DB,
          user.user_id,
          startOfWeek,
          today
        );
        if (entriesThisWeek > 0) {
          stats.skipped++;
          continue;
        }
      } else {
        const weightToday = await getWeightForDate(env.DB, user.user_id, today);
        if (weightToday) {
          stats.skipped++;
          continue;
        }
      }

      const alreadySent = await wasReminderSent(env.DB, user.user_id, today);
      if (alreadySent) {
        stats.skipped++;
        continue;
      }

      const ctx = await buildReminderContext(env, user.user_id, frequency, today);
      const reminderText = reminderTextFor(ctx);
      const response = await sendMessage(
        env.TELEGRAM_BOT_TOKEN,
        user.user_id,
        reminderText,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: RU.btn_enter_weight, callback_data: "menu_enter_weight" }]
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
      logError(`Reminder error for user ${user.user_id}`, error);
      stats.errors++;
    }
  }

  return stats;
}
