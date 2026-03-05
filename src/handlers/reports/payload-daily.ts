import { Env, ReportPayload, ReportUserDelta, ReportGoalsInfo } from "../../types";
import { getTodayDate, getPreviousDay, STREAK_LEVELS, getStreakIcon } from "../../utils";
import {
  getUsersWithWeightOnDate,
  getWeightsForDateByUsers,
  getPreviousWeightsByUsers,
  getOverallFirstAndLastByUsers,
  getWeightsOnOrBeforeDateByUsers,
  getUserStreakLengthsByUsers,
} from "../../db/weights";
import { getUsersOnVacation, getUsersWithDailyFrequency } from "../../db/user-settings";
import { formatDateRu, getGoalSnippetsByUsers, getLeaderFromSubmitted } from "./helpers";

export async function buildDailyPayload(env: Env): Promise<ReportPayload | null> {
  const today = getTodayDate();
  const yesterday = getPreviousDay(today);

  const [dailyUsers, allWithWeightToday, vacationUserIds] = await Promise.all([
    getUsersWithDailyFrequency(env.DB),
    getUsersWithWeightOnDate(env.DB, today),
    getUsersOnVacation(env.DB, today),
  ]);

  const dailyUserIds = new Set(dailyUsers.map((u) => u.user_id));
  const usersToday = allWithWeightToday.filter((u) =>
    dailyUserIds.has(u.user_id),
  );

  if (usersToday.length === 0) return null;

  const userIds = usersToday.map((u) => u.user_id);

  // Batch load: today weights, previous-day weights, overall stats, streak lengths (O(k) queries).
  const [todayWeights, previousWeights, overallByUser, streakLengths] =
    await Promise.all([
      getWeightsForDateByUsers(env.DB, today, userIds),
      getPreviousWeightsByUsers(env.DB, yesterday, userIds),
      getOverallFirstAndLastByUsers(env.DB, userIds),
      getUserStreakLengthsByUsers(env.DB, userIds),
    ]);

  const goalSnippets = await getGoalSnippetsByUsers(
    env.DB,
    userIds,
    overallByUser,
  );

  const submitted: ReportUserDelta[] = [];
  const goalsInfo: ReportGoalsInfo[] = [];
  let sumDayDelta = 0;
  let countWithDelta = 0;
  let hasRegressions = false;
  let firstEntryCount = 0;
  const firstEntryNames: string[] = [];
  const achievementLines: Array<{ name: string; icon: string; days: number }> =
    [];

  for (const user of usersToday) {
    const todayRecord = todayWeights.get(user.user_id);
    if (!todayRecord) continue;

    const streakToday = streakLengths.get(user.user_id) ?? 0;
    const streakYesterday = streakToday >= 1 ? streakToday - 1 : 0;
    const levelCrossed = STREAK_LEVELS.find(
      (l) => streakToday >= l.days && streakYesterday < l.days,
    );
    if (levelCrossed) {
      achievementLines.push({
        name: user.display_name,
        icon: levelCrossed.icon,
        days: levelCrossed.days,
      });
    }

    const previousRecord = previousWeights.get(user.user_id);
    const overallStats = overallByUser.get(user.user_id);
    const goalInfo = goalSnippets.get(user.user_id);

    let totalDelta: number | null = null;
    if (overallStats && overallStats.totalEntries >= 2) {
      totalDelta = overallStats.lastWeight - overallStats.firstWeight;
    }

    let dayDelta: number | null = null;
    if (previousRecord) {
      dayDelta = todayRecord.weight_kg - previousRecord.weight_kg;
      sumDayDelta += dayDelta;
      countWithDelta++;
      if (dayDelta > 0) hasRegressions = true;
    } else {
      if (overallStats && overallStats.totalEntries === 1) {
        firstEntryCount++;
        firstEntryNames.push(user.display_name);
      }
    }

    const streakIcon = getStreakIcon(streakToday);
    submitted.push({
      name: streakIcon ? `${user.display_name} ${streakIcon}` : user.display_name,
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

  const submittedIds = new Set(usersToday.map((u) => u.user_id));
  const vacationSet = new Set(vacationUserIds);
  const missingUsers = dailyUsers.filter(
    (u) => !submittedIds.has(u.user_id) && !vacationSet.has(u.user_id),
  );
  const missing = missingUsers.map((u) => u.display_name);

  const brokenLines: Array<{ name: string; streak: number }> = [];
  if (missingUsers.length > 0) {
    const missingIds = missingUsers.map((u) => u.user_id);
    const lastOnOrBeforeYesterday = await getWeightsOnOrBeforeDateByUsers(
      env.DB,
      yesterday,
      missingIds,
    );
    const streakLengthsMissing = await getUserStreakLengthsByUsers(
      env.DB,
      missingIds,
    );
    for (const user of missingUsers) {
      const lastRec = lastOnOrBeforeYesterday.get(user.user_id);
      if (!lastRec || lastRec.date !== yesterday) continue;
      const len = streakLengthsMissing.get(user.user_id) ?? 0;
      if (len >= 3) {
        brokenLines.push({ name: user.display_name, streak: len });
      }
    }
  }

  const leader = getLeaderFromSubmitted(submitted);

  return {
    date: formatDateRu(today),
    kind: "daily",
    submitted,
    missing,
    hasRegressions,
    sumDayDelta: Math.round(sumDayDelta * 10) / 10,
    avgDayDelta:
      countWithDelta > 0
        ? Math.round((sumDayDelta / countWithDelta) * 100) / 100
        : 0,
    firstEntryCount,
    firstEntryNames,
    goalsInfo: goalsInfo.length > 0 ? goalsInfo : undefined,
    countSubmitted: submitted.length,
    countMissing: missing.length,
    achievementLines:
      achievementLines.length > 0 ? achievementLines : undefined,
    brokenLines: brokenLines.length > 0 ? brokenLines : undefined,
    leader: leader ?? undefined,
  };
}
