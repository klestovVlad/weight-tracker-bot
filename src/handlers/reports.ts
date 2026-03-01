import { Env, ReportPayload } from "../types";
import { sendMessage } from "../telegram/api";
import { getTodayDate, getDateWithOffset } from "../utils";
import { RU, formatDeltaRu } from "../i18n";
import { getSetting } from "../db/settings";
import { humanizeReport } from "../openai";
import {
  getUsersWithWeightOnDate,
  getUsersWithWeightInRange,
  getWeightForDate,
  getPreviousWeight,
  getOverallFirstAndLast,
  countUserEntriesInRange,
  getWeightOnOrBeforeDate,
  getLastWeight,
} from "../db/weights";
import { getUsersOnVacation } from "../db/user-settings";
import { getAllUsers } from "../db/users";
import { getGoal, computeGoalProgress } from "../db/goals";
import { formatGoalSnippet } from "./goal";

interface UserDelta {
  name: string;
  dayDelta: number | null;
  totalDelta: number | null;
  goalRemaining?: number;
  goalPercent?: number;
  goalReached?: boolean;
}

function formatDateRu(dateStr: string): string {
  const [year, month, day] = dateStr.split("-");
  return `${day}.${month}.${year}`;
}

async function getGoalSnippetForUser(
  db: D1Database,
  userId: number
): Promise<{ snippet: string; remaining: number; percent: number; reached: boolean } | null> {
  const goal = await getGoal(db, userId);
  if (!goal) return null;

  const lastWeight = await getLastWeight(db, userId);
  if (!lastWeight) return null;

  const progress = computeGoalProgress(goal, lastWeight.weight_kg);
  const snippet = formatGoalSnippet(progress.remainingKg, progress.percent, progress.reached);

  return {
    snippet,
    remaining: progress.remainingKg,
    percent: progress.percent,
    reached: progress.reached,
  };
}

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
  const submitted: UserDelta[] = [];
  let sumDayDelta = 0;
  let countWithDelta = 0;
  let hasRegressions = false;
  let firstEntryCount = 0;
  const firstEntryNames: string[] = [];

  for (const user of usersToday) {
    const todayRecord = await getWeightForDate(env.DB, user.user_id, today);
    if (!todayRecord) continue;

    const previousRecord = await getPreviousWeight(env.DB, user.user_id, today);
    const overallStats = await getOverallFirstAndLast(env.DB, user.user_id);

    let totalDelta: number | null = null;
    let totalDeltaStr = RU.no_data;
    if (overallStats && overallStats.totalEntries >= 2) {
      totalDelta = overallStats.lastWeight - overallStats.firstWeight;
      totalDeltaStr = formatDeltaRu(totalDelta);
    }

    const goalInfo = await getGoalSnippetForUser(env.DB, user.user_id);
    const goalSnippet = goalInfo ? ` | ${goalInfo.snippet}` : "";

    let dayDelta: number | null = null;
    if (previousRecord) {
      dayDelta = todayRecord.weight_kg - previousRecord.weight_kg;
      lines.push(RU.report_daily_line(user.display_name, formatDeltaRu(dayDelta), totalDeltaStr) + goalSnippet);
      sumDayDelta += dayDelta;
      countWithDelta++;
      if (dayDelta > 0) hasRegressions = true;
    } else {
      if (overallStats && overallStats.totalEntries === 1) {
        lines.push(RU.report_daily_first(user.display_name) + goalSnippet);
        firstEntryCount++;
        firstEntryNames.push(user.display_name);
      } else {
        lines.push(RU.report_daily_no_prev(user.display_name, totalDeltaStr) + goalSnippet);
      }
    }

    submitted.push({
      name: user.display_name,
      dayDelta,
      totalDelta,
      goalRemaining: goalInfo?.remaining,
      goalPercent: goalInfo?.percent,
      goalReached: goalInfo?.reached,
    });
  }

  const allUsers = await getAllUsers(env.DB);
  const submittedIds = new Set(usersToday.map(u => u.user_id));
  const vacationUserIds = new Set(await getUsersOnVacation(env.DB, today));
  const missing = allUsers
    .filter(u => !submittedIds.has(u.user_id) && !vacationUserIds.has(u.user_id))
    .map(u => u.display_name);

  const payload: ReportPayload = {
    date: formatDateRu(today),
    kind: "daily",
    submitted,
    missing,
    hasRegressions,
    sumDayDelta: Math.round(sumDayDelta * 10) / 10,
    avgDayDelta: countWithDelta > 0 ? Math.round((sumDayDelta / countWithDelta) * 100) / 100 : 0,
    firstEntryCount,
    firstEntryNames,
    countSubmitted: submitted.length,
    countMissing: missing.length,
  };

  const { intro, outro } = await humanizeReport(payload, env);

  let report = "";
  if (intro) {
    report += intro + "\n\n";
  }
  report += RU.report_daily_header + "\n" + lines.join("\n");
  if (outro) {
    report += "\n\n" + outro;
  }

  await sendMessage(env.TELEGRAM_BOT_TOKEN, publicChatId, report, { parse_mode: "HTML" });
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
  const submitted: UserDelta[] = [];
  let sumWeekDelta = 0;
  let countWithDelta = 0;
  let hasRegressions = false;

  for (const user of usersThisWeek) {
    const checkins = await countUserEntriesInRange(env.DB, user.user_id, weekAgo, today);

    const latestThisWeek = await getWeightOnOrBeforeDate(env.DB, user.user_id, today);
    const beforeWeek = getDateWithOffset(-7);
    const weightBeforeWeek = await getWeightOnOrBeforeDate(env.DB, user.user_id, beforeWeek);

    const overallStats = await getOverallFirstAndLast(env.DB, user.user_id);

    let totalDelta: number | null = null;
    let totalDeltaStr = RU.no_data;
    if (overallStats && overallStats.totalEntries >= 2) {
      totalDelta = overallStats.lastWeight - overallStats.firstWeight;
      totalDeltaStr = formatDeltaRu(totalDelta);
    }

    const goalInfo = await getGoalSnippetForUser(env.DB, user.user_id);
    const goalSnippet = goalInfo ? ` | ${goalInfo.snippet}` : "";

    let weekDelta: number | null = null;
    if (latestThisWeek && weightBeforeWeek && latestThisWeek.date !== weightBeforeWeek.date) {
      weekDelta = latestThisWeek.weight_kg - weightBeforeWeek.weight_kg;
      lines.push(RU.report_weekly_line(user.display_name, formatDeltaRu(weekDelta), totalDeltaStr, checkins) + goalSnippet);
      sumWeekDelta += weekDelta;
      countWithDelta++;
      if (weekDelta > 0) hasRegressions = true;
    } else {
      lines.push(RU.report_weekly_no_week(user.display_name, totalDeltaStr, checkins) + goalSnippet);
    }

    submitted.push({
      name: user.display_name,
      dayDelta: weekDelta,
      totalDelta,
      goalRemaining: goalInfo?.remaining,
      goalPercent: goalInfo?.percent,
      goalReached: goalInfo?.reached,
    });
  }

  const allUsers = await getAllUsers(env.DB);
  const submittedIds = new Set(usersThisWeek.map(u => u.user_id));
  const vacationUserIds = new Set(await getUsersOnVacation(env.DB, today));
  const missing = allUsers
    .filter(u => !submittedIds.has(u.user_id) && !vacationUserIds.has(u.user_id))
    .map(u => u.display_name);

  const payload: ReportPayload = {
    date: formatDateRu(today),
    kind: "weekly",
    submitted,
    missing,
    hasRegressions,
    sumDayDelta: Math.round(sumWeekDelta * 10) / 10,
    avgDayDelta: countWithDelta > 0 ? Math.round((sumWeekDelta / countWithDelta) * 100) / 100 : 0,
    firstEntryCount: 0,
    firstEntryNames: [],
    countSubmitted: submitted.length,
    countMissing: missing.length,
  };

  const { intro, outro } = await humanizeReport(payload, env);

  let report = "";
  if (intro) {
    report += intro + "\n\n";
  }
  report += RU.report_weekly_header + "\n" + lines.join("\n");
  if (outro) {
    report += "\n\n" + outro;
  }

  await sendMessage(env.TELEGRAM_BOT_TOKEN, publicChatId, report, { parse_mode: "HTML" });
}

export async function generateMonthlyReport(env: Env): Promise<void> {
  const publicChatId = await getSetting(env.DB, "public_chat_id");
  if (!publicChatId) {
    return;
  }

  const today = getTodayDate();
  const [year, month] = today.split("-").map(Number);

  const firstDayOfMonth = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDayOfMonth = today;

  const usersThisMonth = await getUsersWithWeightInRange(env.DB, firstDayOfMonth, lastDayOfMonth);

  if (usersThisMonth.length === 0) {
    await sendMessage(env.TELEGRAM_BOT_TOKEN, publicChatId, RU.report_no_entries_month);
    return;
  }

  const lines: string[] = [];
  const submitted: UserDelta[] = [];
  let sumMonthDelta = 0;
  let countWithDelta = 0;
  let hasRegressions = false;

  for (const user of usersThisMonth) {
    const checkins = await countUserEntriesInRange(env.DB, user.user_id, firstDayOfMonth, lastDayOfMonth);

    const firstInMonth = await getWeightForDate(env.DB, user.user_id, firstDayOfMonth)
      || await getWeightOnOrBeforeDate(env.DB, user.user_id, lastDayOfMonth);
    const lastInMonth = await getWeightOnOrBeforeDate(env.DB, user.user_id, lastDayOfMonth);

    const overallStats = await getOverallFirstAndLast(env.DB, user.user_id);

    let totalDelta: number | null = null;
    let totalDeltaStr = RU.no_data;
    if (overallStats && overallStats.totalEntries >= 2) {
      totalDelta = overallStats.lastWeight - overallStats.firstWeight;
      totalDeltaStr = formatDeltaRu(totalDelta);
    }

    const goalInfo = await getGoalSnippetForUser(env.DB, user.user_id);
    const goalSnippet = goalInfo ? ` | ${goalInfo.snippet}` : "";

    let monthDelta: number | null = null;
    if (firstInMonth && lastInMonth && firstInMonth.date !== lastInMonth.date) {
      monthDelta = lastInMonth.weight_kg - firstInMonth.weight_kg;
      lines.push(RU.report_monthly_line(user.display_name, formatDeltaRu(monthDelta), checkins, totalDeltaStr) + goalSnippet);
      sumMonthDelta += monthDelta;
      countWithDelta++;
      if (monthDelta > 0) hasRegressions = true;
    } else {
      lines.push(RU.report_monthly_no_delta(user.display_name, checkins, totalDeltaStr) + goalSnippet);
    }

    submitted.push({
      name: user.display_name,
      dayDelta: monthDelta,
      totalDelta,
      goalRemaining: goalInfo?.remaining,
      goalPercent: goalInfo?.percent,
      goalReached: goalInfo?.reached,
    });
  }

  const allUsers = await getAllUsers(env.DB);
  const submittedIds = new Set(usersThisMonth.map(u => u.user_id));
  const vacationUserIds = new Set(await getUsersOnVacation(env.DB, today));
  const missing = allUsers
    .filter(u => !submittedIds.has(u.user_id) && !vacationUserIds.has(u.user_id))
    .map(u => u.display_name);

  const payload: ReportPayload = {
    date: formatDateRu(today),
    kind: "weekly",
    submitted,
    missing,
    hasRegressions,
    sumDayDelta: Math.round(sumMonthDelta * 10) / 10,
    avgDayDelta: countWithDelta > 0 ? Math.round((sumMonthDelta / countWithDelta) * 100) / 100 : 0,
    firstEntryCount: 0,
    firstEntryNames: [],
    countSubmitted: submitted.length,
    countMissing: missing.length,
  };

  const { intro, outro } = await humanizeReport(payload, env);

  let report = "";
  if (intro) {
    report += intro + "\n\n";
  }
  report += RU.report_monthly_header + "\n" + lines.join("\n");
  if (outro) {
    report += "\n\n" + outro;
  }

  await sendMessage(env.TELEGRAM_BOT_TOKEN, publicChatId, report, { parse_mode: "HTML" });
}

export function isLastDayOfMonth(dateStr: string): boolean {
  const date = new Date(dateStr + "T12:00:00Z");
  const nextDay = new Date(date);
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);
  return nextDay.getUTCDate() === 1;
}
