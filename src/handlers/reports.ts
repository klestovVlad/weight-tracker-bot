import { Env, ReportPayload } from "../types";
import { sendMessage, sendPhoto } from "../telegram/api";
import { getTodayDate, getDateWithOffset, getStreakIcon, STREAK_LEVELS, getPreviousDay } from "../utils";
import { RU, formatDeltaRu } from "../i18n";
import { getSetting } from "../db/settings";
import { humanizeReport } from "../openai";
import { pickMemeObject } from "../helpers/meme";
import { getMemeImageUrl } from "../helpers/meme-image";
import {
  getUsersWithWeightOnDate,
  getUsersWithWeightInRange,
  getWeightForDate,
  getPreviousWeight,
  getOverallFirstAndLast,
  countUserEntriesInRange,
  getWeightOnOrBeforeDate,
  getLastWeight,
  getUserStreak,
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

function nameWithStreakIcon(name: string, icon: string): string {
  return icon ? `${name} ${icon}` : name;
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
  const goalsInfo: Array<{ name: string; remaining: number; percent: number; reached: boolean }> = [];
  let sumDayDelta = 0;
  let countWithDelta = 0;
  let hasRegressions = false;
  let firstEntryCount = 0;
  const firstEntryNames: string[] = [];

  const yesterday = getPreviousDay(today);
  const achievementLines: Array<{ name: string; icon: string; days: number }> = [];

  for (const user of usersToday) {
    const todayRecord = await getWeightForDate(env.DB, user.user_id, today);
    if (!todayRecord) continue;

    const streakInfo = await getUserStreak(env.DB, user.user_id);
    const streakToday = streakInfo?.length ?? 0;
    const streakYesterday = streakToday >= 1 ? streakToday - 1 : 0;
    const levelCrossed = STREAK_LEVELS.find(
      (l) => streakToday >= l.days && streakYesterday < l.days
    );
    if (levelCrossed) {
      achievementLines.push({
        name: user.display_name,
        icon: levelCrossed.icon,
        days: levelCrossed.days,
      });
    }

    const streakIcon = getStreakIcon(streakToday);
    const nameWithIcon = nameWithStreakIcon(user.display_name, streakIcon);

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
      lines.push(RU.report_daily_line(nameWithIcon, formatDeltaRu(dayDelta), totalDeltaStr) + goalSnippet);
      sumDayDelta += dayDelta;
      countWithDelta++;
      if (dayDelta > 0) hasRegressions = true;
    } else {
      if (overallStats && overallStats.totalEntries === 1) {
        lines.push(RU.report_daily_first(nameWithIcon) + goalSnippet);
        firstEntryCount++;
        firstEntryNames.push(user.display_name);
      } else {
        lines.push(RU.report_daily_no_prev(nameWithIcon, totalDeltaStr) + goalSnippet);
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

    if (goalInfo) {
      goalsInfo.push({
        name: user.display_name,
        remaining: goalInfo.remaining,
        percent: goalInfo.percent,
        reached: goalInfo.reached,
      });
    }
  }

  const allUsers = await getAllUsers(env.DB);
  const submittedIds = new Set(usersToday.map((u) => u.user_id));
  const vacationUserIds = new Set(await getUsersOnVacation(env.DB, today));
  const missingUsers = allUsers.filter(
    (u) => !submittedIds.has(u.user_id) && !vacationUserIds.has(u.user_id)
  );
  const missing = missingUsers.map((u) => u.display_name);

  const brokenLines: Array<{ name: string; streak: number }> = [];
  for (const user of missingUsers) {
    const lastOnYesterday = await getWeightOnOrBeforeDate(env.DB, user.user_id, yesterday);
    if (!lastOnYesterday || lastOnYesterday.date !== yesterday) continue;
    const streakInfo = await getUserStreak(env.DB, user.user_id);
    if (streakInfo && streakInfo.length >= 3) {
      brokenLines.push({ name: user.display_name, streak: streakInfo.length });
    }
  }

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
    goalsInfo: goalsInfo.length > 0 ? goalsInfo : undefined,
    countSubmitted: submitted.length,
    countMissing: missing.length,
  };

  const { intro, outro } = await humanizeReport(payload, env);

  let report = "";
  if (intro) {
    report += intro + "\n\n";
  }
  report += RU.report_daily_header + "\n" + lines.join("\n");

  if (achievementLines.length > 0) {
    report += "\n\n" + RU.report_achievements_header + "\n";
    report += achievementLines
      .map((a) => RU.report_achievement_line(a.name, a.icon, a.days))
      .join("\n");
  }
  if (brokenLines.length > 0) {
    report += "\n\n" + RU.report_broken_header + "\n";
    report += brokenLines
      .map((b) => RU.report_broken_line(b.name, b.streak))
      .join("\n");
  }

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
  const goalsInfo: Array<{ name: string; remaining: number; percent: number; reached: boolean }> = [];
  const weekDeltaEntries: Array<{ name: string; userId: number; weekDelta: number; checkins: number }> = [];
  let sumWeekDelta = 0;
  let countWithDelta = 0;
  let hasRegressions = false;

  for (const user of usersThisWeek) {
    const checkins = await countUserEntriesInRange(env.DB, user.user_id, weekAgo, today);

    const streakInfo = await getUserStreak(env.DB, user.user_id);
    const streakIcon = getStreakIcon(streakInfo?.length ?? 0);
    const nameWithIcon = nameWithStreakIcon(user.display_name, streakIcon);

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
      weekDeltaEntries.push({ name: user.display_name, userId: user.user_id, weekDelta, checkins });
      lines.push(RU.report_weekly_line(nameWithIcon, formatDeltaRu(weekDelta), totalDeltaStr, checkins) + goalSnippet);
      sumWeekDelta += weekDelta;
      countWithDelta++;
      if (weekDelta > 0) hasRegressions = true;
    } else {
      lines.push(RU.report_weekly_no_week(nameWithIcon, totalDeltaStr, checkins) + goalSnippet);
    }

    submitted.push({
      name: user.display_name,
      dayDelta: weekDelta,
      totalDelta,
      goalRemaining: goalInfo?.remaining,
      goalPercent: goalInfo?.percent,
      goalReached: goalInfo?.reached,
    });

    if (goalInfo) {
      goalsInfo.push({
        name: user.display_name,
        remaining: goalInfo.remaining,
        percent: goalInfo.percent,
        reached: goalInfo.reached,
      });
    }
  }

  let heroesSection = "";
  if (weekDeltaEntries.length > 0) {
    const minDelta = Math.min(...weekDeltaEntries.map((e) => e.weekDelta));
    const heroes = weekDeltaEntries.filter((e) => e.weekDelta === minDelta);
    if (heroes.length > 0 && minDelta <= 0) {
      const heroLines: string[] = [];
      for (const h of heroes) {
        const streakInfo = await getUserStreak(env.DB, h.userId);
        const icon = getStreakIcon(streakInfo?.length ?? 0);
        const nameWithIcon = nameWithStreakIcon(h.name, icon);
        heroLines.push(RU.report_hero_line(nameWithIcon, formatDeltaRu(h.weekDelta), h.checkins));
      }
      heroesSection = "\n\n" + RU.report_heroes_header + "\n" + heroLines.join("\n");
    }
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
    goalsInfo: goalsInfo.length > 0 ? goalsInfo : undefined,
    countSubmitted: submitted.length,
    countMissing: missing.length,
  };

  const result = await humanizeReport(payload, env);
  const { intro, outro, meme } = result;

  const memesEnabled = (await getSetting(env.DB, "memes_enabled")) === "true";
  const memeObject = meme?.object ?? pickMemeObject(payload.sumDayDelta);
  if (memesEnabled) {
    const imageUrl = await getMemeImageUrl(env, memeObject, payload.sumDayDelta);
    if (imageUrl) {
      const caption = meme?.caption ?? "";
      await sendPhoto(env.TELEGRAM_BOT_TOKEN, publicChatId, imageUrl, caption || undefined);
    }
  }

  let report = intro ? intro + "\n\n" : "";
  report += lines.join("\n");
  report += heroesSection;
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
  const goalsInfo: Array<{ name: string; remaining: number; percent: number; reached: boolean }> = [];
  let sumMonthDelta = 0;
  let countWithDelta = 0;
  let hasRegressions = false;

  for (const user of usersThisMonth) {
    const checkins = await countUserEntriesInRange(env.DB, user.user_id, firstDayOfMonth, lastDayOfMonth);

    const streakInfo = await getUserStreak(env.DB, user.user_id);
    const streakIcon = getStreakIcon(streakInfo?.length ?? 0);
    const nameWithIcon = nameWithStreakIcon(user.display_name, streakIcon);

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
      lines.push(RU.report_monthly_line(nameWithIcon, formatDeltaRu(monthDelta), checkins, totalDeltaStr) + goalSnippet);
      sumMonthDelta += monthDelta;
      countWithDelta++;
      if (monthDelta > 0) hasRegressions = true;
    } else {
      lines.push(RU.report_monthly_no_delta(nameWithIcon, checkins, totalDeltaStr) + goalSnippet);
    }

    submitted.push({
      name: user.display_name,
      dayDelta: monthDelta,
      totalDelta,
      goalRemaining: goalInfo?.remaining,
      goalPercent: goalInfo?.percent,
      goalReached: goalInfo?.reached,
    });

    if (goalInfo) {
      goalsInfo.push({
        name: user.display_name,
        remaining: goalInfo.remaining,
        percent: goalInfo.percent,
        reached: goalInfo.reached,
      });
    }
  }

  const allUsers = await getAllUsers(env.DB);
  const submittedIds = new Set(usersThisMonth.map(u => u.user_id));
  const vacationUserIds = new Set(await getUsersOnVacation(env.DB, today));
  const missing = allUsers
    .filter(u => !submittedIds.has(u.user_id) && !vacationUserIds.has(u.user_id))
    .map(u => u.display_name);

  const payload: ReportPayload = {
    date: formatDateRu(today),
    kind: "monthly",
    submitted,
    missing,
    hasRegressions,
    sumDayDelta: Math.round(sumMonthDelta * 10) / 10,
    avgDayDelta: countWithDelta > 0 ? Math.round((sumMonthDelta / countWithDelta) * 100) / 100 : 0,
    firstEntryCount: 0,
    firstEntryNames: [],
    goalsInfo: goalsInfo.length > 0 ? goalsInfo : undefined,
    countSubmitted: submitted.length,
    countMissing: missing.length,
  };

  const result = await humanizeReport(payload, env);
  const { intro, outro, meme } = result;

  const memesEnabled = (await getSetting(env.DB, "memes_enabled")) === "true";
  const memeObject = meme?.object ?? pickMemeObject(payload.sumDayDelta);
  if (memesEnabled) {
    const imageUrl = await getMemeImageUrl(env, memeObject, payload.sumDayDelta);
    if (imageUrl) {
      const caption = meme?.caption ?? "";
      await sendPhoto(env.TELEGRAM_BOT_TOKEN, publicChatId, imageUrl, caption || undefined);
    }
  }

  let report = intro ? intro + "\n\n" : "";
  report += lines.join("\n");
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
