import { Env } from "../types";
import { sendMessage } from "../telegram/api";
import { RU } from "../i18n";
import { getStreakIcon, getNextStreakLevel, STREAK_LEVELS } from "../utils";
import { getCrownUserId } from "../db/settings";
import { getUserStreak, getOverallFirstAndLast } from "../db/weights";
import { earnedLossBadges, nextLossBadge } from "../helpers/badges";

function progressBar(current: number, target: number, length: number = 12): string {
  if (target <= 0) return "";
  const p = Math.min(1, Math.max(0, current / target));
  const filled = Math.round(p * length);
  const empty = length - filled;
  return "█".repeat(filled) + "░".repeat(empty);
}

export async function handleMyAchievements(
  env: Env,
  chatId: number,
  userId: number
): Promise<Response> {
  const [streakInfo, crownUserId, overall] = await Promise.all([
    getUserStreak(env.DB, userId),
    getCrownUserId(env.DB),
    getOverallFirstAndLast(env.DB, userId),
  ]);
  const streak = streakInfo?.length ?? 0;
  const icon = getStreakIcon(streak);
  const nextLevel = getNextStreakLevel(streak);
  const hasCrown = crownUserId != null && userId === crownUserId;

  let text = RU.achievements_title + "\n\n";
  if (hasCrown) text += RU.achievements_crown + "\n\n";

  if (streak < 3) {
    const left = 3 - streak;
    text += RU.achievements_start(left);
  } else if (streak >= 90) {
    text += RU.achievements_legend;
  } else {
    text += RU.achievements_streak(streak, icon) + "\n\n";
    if (nextLevel !== null) {
      const left = nextLevel - streak;
      const nextIcon = STREAK_LEVELS.find((l) => l.days === nextLevel)?.icon ?? "";
      text += RU.achievements_next(nextIcon, nextLevel, left) + "\n\n";
      text += progressBar(streak, nextLevel) + ` ${streak}/${nextLevel}\n\n`;
    }
    text += RU.achievements_history_title + "\n";
    for (const level of STREAK_LEVELS) {
      const reached = streak >= level.days;
      text += (reached ? RU.achievements_level_done(level.icon, level.days) : RU.achievements_level_in_progress(level.icon, level.days)) + "\n";
    }
  }

  // Weight-loss badges (since start).
  if (overall && overall.totalEntries >= 2) {
    const lostKg = Math.max(0, overall.firstWeight - overall.lastWeight);
    if (lostKg > 0) {
      text += "\n\n" + RU.achievements_loss_title(lostKg.toFixed(1)) + "\n";
      const earned = earnedLossBadges(lostKg);
      if (earned.length > 0) {
        text += RU.achievements_loss_badges(earned.map((b) => b.icon).join(" ")) + "\n";
      }
      const next = nextLossBadge(lostKg);
      if (next) {
        text += RU.achievements_loss_next(next.icon, next.label, (next.kg - lostKg).toFixed(1));
      }
    }
  }

  const keyboard = {
    inline_keyboard: [[{ text: RU.btn_back, callback_data: "menu_back_main" }]],
  };

  return sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, text, { reply_markup: keyboard });
}
