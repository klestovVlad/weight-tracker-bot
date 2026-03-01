import { Env } from "../types";
import { sendMessage } from "../telegram/api";
import { RU } from "../i18n";
import { getStreakIcon, getNextStreakLevel, STREAK_LEVELS } from "../utils";
import { getUserStreak } from "../db/weights";

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
  const streakInfo = await getUserStreak(env.DB, userId);
  const streak = streakInfo?.length ?? 0;
  const icon = getStreakIcon(streak);
  const nextLevel = getNextStreakLevel(streak);

  let text = RU.achievements_title + "\n\n";

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

  const keyboard = {
    inline_keyboard: [[{ text: RU.btn_back, callback_data: "menu_back_main" }]],
  };

  return sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, text, { reply_markup: keyboard });
}
