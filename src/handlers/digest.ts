import { Env } from "../types";
import { sendMessage } from "../telegram/api";
import { RU, formatDeltaRu } from "../i18n";
import { getWeightHistory, getUserStreak } from "../db/weights";
import { getGoal, computeGoalProgress } from "../db/goals";
import { getHeightCm, getUsersForDigest } from "../db/user-settings";
import { computeBmi, bmiCategory } from "../helpers/health";
import { forecastGoalDate } from "../helpers/forecast";
import { getTodayDate, getDateWithOffset, getDaysBetween, getPreviousDay } from "../utils";
import { logError } from "../helpers/logging";

/** Don't send a digest to users who've been silent longer than this. */
const COLD_DAYS = 14;

function formatEtaDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  return `${day}.${month}.${year}`;
}

/**
 * Builds a personal weekly digest for a user, or null if they should be skipped
 * (no data, or cold). Private message → may include absolute weight and BMI.
 */
export async function buildDigestText(env: Env, userId: number): Promise<string | null> {
  const history = await getWeightHistory(env.DB, userId, 60); // most-recent first
  if (history.length === 0) return null;

  const today = getTodayDate();
  const last = history[0];
  if (getDaysBetween(last.date, today) > COLD_DAYS) return null;

  const lines: string[] = [RU.digest_title, ""];

  // Week delta from entries in the last 7 days.
  const weekCutoff = getDateWithOffset(-7);
  const weekEntries = history.filter((r) => r.date >= weekCutoff);
  if (weekEntries.length >= 2) {
    const newest = weekEntries[0].weight_kg;
    const oldest = weekEntries[weekEntries.length - 1].weight_kg;
    lines.push("📉 " + RU.digest_week(formatDeltaRu(newest - oldest)));
  }

  lines.push(RU.digest_current(last.weight_kg.toFixed(1)));

  const heightCm = await getHeightCm(env.DB, userId);
  const bmi = computeBmi(last.weight_kg, heightCm);
  if (bmi !== null) {
    const cat = bmiCategory(bmi);
    lines.push(RU.me_bmi(bmi.toFixed(1), cat.emoji, cat.label));
  }

  // Streak (consecutive days up to the last entry).
  const streak = await getUserStreak(env.DB, userId);
  const yesterday = getPreviousDay(today);
  const streakActive =
    streak && (streak.lastDate === today || streak.lastDate === yesterday);
  if (streakActive && streak!.length >= 2) {
    lines.push(RU.digest_streak(streak!.length));
  } else {
    lines.push(RU.digest_no_streak);
  }

  // Goal + forecast.
  const goal = await getGoal(env.DB, userId);
  if (goal) {
    const progress = computeGoalProgress(goal, last.weight_kg);
    if (progress.reached) {
      lines.push(RU.digest_goal_reached);
    } else {
      lines.push(RU.digest_goal(progress.remainingKg.toFixed(1), progress.percent));
      const forecast = forecastGoalDate(
        history.map((r) => ({ date: r.date, weightKg: r.weight_kg })),
        goal.target_weight_kg,
        today,
      );
      if (forecast && forecast.daysLeft > 0) {
        lines.push(RU.goal_forecast(formatEtaDate(forecast.etaDate), forecast.daysLeft).trim());
      }
    }
  }

  lines.push("", RU.digest_footer);
  return lines.join("\n");
}

export interface DigestStats {
  sent: number;
  skipped: number;
  errors: number;
}

/** Sends the weekly personal digest to all opted-in users. */
export async function runWeeklyDigests(env: Env): Promise<DigestStats> {
  const stats: DigestStats = { sent: 0, skipped: 0, errors: 0 };
  const users = await getUsersForDigest(env.DB);

  for (const user of users) {
    try {
      const text = await buildDigestText(env, user.user_id);
      if (!text) {
        stats.skipped++;
        continue;
      }
      const response = await sendMessage(env.TELEGRAM_BOT_TOKEN, user.user_id, text);
      const result = (await response.json()) as { ok: boolean };
      if (result.ok) stats.sent++;
      else stats.errors++;
    } catch (error) {
      logError(`Digest error for user ${user.user_id}`, error);
      stats.errors++;
    }
  }

  return stats;
}
