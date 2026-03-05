import { Env, ReportPayload, ReportUserDelta, ReportGoalsInfo } from "../../types";
import { getTodayDate, getDateWithOffset, getStreakIcon } from "../../utils";
import {
  getUsersWithWeightInRange,
  getWeightsOnOrBeforeDateByUsers,
  getOverallFirstAndLastByUsers,
  getUserStreakLengthsByUsers,
} from "../../db/weights";
import { getUsersOnVacation } from "../../db/user-settings";
import { getAllUsers } from "../../db/users";
import { formatDateRu, getGoalSnippetsByUsers, getLeaderFromSubmitted } from "./helpers";

export async function buildWeeklyPayload(
  env: Env,
): Promise<ReportPayload | null> {
  const today = getTodayDate();
  const weekAgo = getDateWithOffset(-6);
  const beforeWeek = getDateWithOffset(-7);

  const usersThisWeek = await getUsersWithWeightInRange(
    env.DB,
    weekAgo,
    today,
  );

  if (usersThisWeek.length === 0) return null;

  const userIds = usersThisWeek.map((u) => u.user_id);

  const [latestByEndOfWeek, weightBeforeWeek, overallByUser, streakLengths] =
    await Promise.all([
      getWeightsOnOrBeforeDateByUsers(env.DB, today, userIds),
      getWeightsOnOrBeforeDateByUsers(env.DB, beforeWeek, userIds),
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
  let sumWeekDelta = 0;
  let countWithDelta = 0;
  let hasRegressions = false;

  for (const user of usersThisWeek) {
    const latestThisWeek = latestByEndOfWeek.get(user.user_id);
    const weightBefore = weightBeforeWeek.get(user.user_id);
    const overallStats = overallByUser.get(user.user_id);
    const goalInfo = goalSnippets.get(user.user_id);

    let totalDelta: number | null = null;
    if (overallStats && overallStats.totalEntries >= 2) {
      totalDelta = overallStats.lastWeight - overallStats.firstWeight;
    }

    let weekDelta: number | null = null;
    if (
      latestThisWeek &&
      weightBefore &&
      latestThisWeek.date !== weightBefore.date
    ) {
      weekDelta = latestThisWeek.weight_kg - weightBefore.weight_kg;
      sumWeekDelta += weekDelta;
      countWithDelta++;
      if (weekDelta > 0) hasRegressions = true;
    }

    const streakIcon = getStreakIcon(streakLengths.get(user.user_id) ?? 0);
    submitted.push({
      name: streakIcon ? `${user.display_name} ${streakIcon}` : user.display_name,
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

  const allUsers = await getAllUsers(env.DB);
  const submittedIds = new Set(usersThisWeek.map((u) => u.user_id));
  const vacationUserIds = new Set(await getUsersOnVacation(env.DB, today));
  const missing = allUsers
    .filter(
      (u) => !submittedIds.has(u.user_id) && !vacationUserIds.has(u.user_id),
    )
    .map((u) => u.display_name);

  const leader = getLeaderFromSubmitted(submitted);

  return {
    date: formatDateRu(today),
    kind: "weekly",
    submitted,
    missing,
    hasRegressions,
    sumDayDelta: Math.round(sumWeekDelta * 10) / 10,
    avgDayDelta:
      countWithDelta > 0
        ? Math.round((sumWeekDelta / countWithDelta) * 100) / 100
        : 0,
    firstEntryCount: 0,
    firstEntryNames: [],
    goalsInfo: goalsInfo.length > 0 ? goalsInfo : undefined,
    countSubmitted: submitted.length,
    countMissing: missing.length,
    leader: leader ?? undefined,
  };
}
