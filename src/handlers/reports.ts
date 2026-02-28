import { Env } from "../types";
import { sendMessage } from "../telegram/api";
import { getTodayDate, getDateWithOffset } from "../utils";
import { RU, formatDeltaRu } from "../i18n";
import { getSetting } from "../db/settings";
import {
  getUsersWithWeightOnDate,
  getUsersWithWeightInRange,
  getWeightForDate,
  getPreviousWeight,
  getOverallFirstAndLast,
  countUserEntriesInRange,
  getWeightOnOrBeforeDate,
} from "../db/weights";

export async function generateDailyReport(env: Env): Promise<void> {
  const publicChatId = await getSetting(env.DB, "public_chat_id");
  if (!publicChatId) {
    return;
  }

  const today = getTodayDate();
  const usersToday = await getUsersWithWeightOnDate(env.DB, today);

  if (usersToday.length === 0) {
    await sendMessage(env.TELEGRAM_BOT_TOKEN, publicChatId, RU.report_no_entries_today);
    return;
  }

  const lines: string[] = [];

  for (const user of usersToday) {
    const todayRecord = await getWeightForDate(env.DB, user.user_id, today);
    if (!todayRecord) continue;

    const previousRecord = await getPreviousWeight(env.DB, user.user_id, today);
    const overallStats = await getOverallFirstAndLast(env.DB, user.user_id);

    let totalDeltaStr = RU.no_data;
    if (overallStats && overallStats.totalEntries >= 2) {
      const totalDelta = overallStats.lastWeight - overallStats.firstWeight;
      totalDeltaStr = formatDeltaRu(totalDelta);
    }

    if (previousRecord) {
      const dayDelta = todayRecord.weight_kg - previousRecord.weight_kg;
      lines.push(RU.report_daily_line(user.display_name, formatDeltaRu(dayDelta), totalDeltaStr));
    } else {
      if (overallStats && overallStats.totalEntries === 1) {
        lines.push(RU.report_daily_first(user.display_name));
      } else {
        lines.push(RU.report_daily_no_prev(user.display_name, totalDeltaStr));
      }
    }
  }

  const report = RU.report_daily_header + "\n" + lines.join("\n");
  await sendMessage(env.TELEGRAM_BOT_TOKEN, publicChatId, report);
}

export async function generateWeeklyReport(env: Env): Promise<void> {
  const publicChatId = await getSetting(env.DB, "public_chat_id");
  if (!publicChatId) {
    return;
  }

  const today = getTodayDate();
  const weekAgo = getDateWithOffset(-6);

  const usersThisWeek = await getUsersWithWeightInRange(env.DB, weekAgo, today);

  if (usersThisWeek.length === 0) {
    await sendMessage(env.TELEGRAM_BOT_TOKEN, publicChatId, RU.report_no_entries_week);
    return;
  }

  const lines: string[] = [];

  for (const user of usersThisWeek) {
    const checkins = await countUserEntriesInRange(env.DB, user.user_id, weekAgo, today);

    const latestThisWeek = await getWeightOnOrBeforeDate(env.DB, user.user_id, today);
    const beforeWeek = getDateWithOffset(-7);
    const weightBeforeWeek = await getWeightOnOrBeforeDate(env.DB, user.user_id, beforeWeek);

    const overallStats = await getOverallFirstAndLast(env.DB, user.user_id);

    let totalDeltaStr = RU.no_data;
    if (overallStats && overallStats.totalEntries >= 2) {
      const totalDelta = overallStats.lastWeight - overallStats.firstWeight;
      totalDeltaStr = formatDeltaRu(totalDelta);
    }

    if (latestThisWeek && weightBeforeWeek && latestThisWeek.date !== weightBeforeWeek.date) {
      const weekDelta = latestThisWeek.weight_kg - weightBeforeWeek.weight_kg;
      lines.push(RU.report_weekly_line(user.display_name, formatDeltaRu(weekDelta), totalDeltaStr, checkins));
    } else {
      lines.push(RU.report_weekly_no_week(user.display_name, totalDeltaStr, checkins));
    }
  }

  const report = RU.report_weekly_header + "\n" + lines.join("\n");
  await sendMessage(env.TELEGRAM_BOT_TOKEN, publicChatId, report);
}
