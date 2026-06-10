import { Env, ReportPayload, ReportUserDelta, ReportGoalsInfo } from "../../types";
import { getTodayDate, getDateWithOffset, getStreakIcon } from "../../utils";
import {
  getUsersWithWeightInRange,
  getFirstWeightInRangeByUsers,
  getLastWeightInRangeByUsers,
  getOverallFirstAndLastByUsers,
  getUserStreakLengthsByUsers,
} from "../../db/weights";
import { getUsersOnVacation } from "../../db/user-settings";
import { getCrownUserId } from "../../db/settings";
import { getAllUsers } from "../../db/users";
import { formatDateRu, getGoalSnippetsByUsers } from "./helpers";

export async function buildWeeklyPayload(
  env: Env,
): Promise<ReportPayload | null> {
  const today = getTodayDate();
  const weekStart = getDateWithOffset(-6);

  const usersThisWeek = await getUsersWithWeightInRange(
    env.DB,
    weekStart,
    today,
  );

  if (usersThisWeek.length === 0) return null;

  const userIds = usersThisWeek.map((u) => u.user_id);

  const [firstInWeekByUser, lastInWeekByUser, overallByUser, streakLengths] =
    await Promise.all([
      getFirstWeightInRangeByUsers(env.DB, weekStart, today, userIds),
      getLastWeightInRangeByUsers(env.DB, weekStart, today, userIds),
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
  let sumTotalDelta = 0;
  let countWithDelta = 0;
  let hasRegressions = false;
  let leaderCandidate: { name: string; dayDelta: number; userId: number } | null = null;

  const crownUserId = await getCrownUserId(env.DB);

  for (const user of usersThisWeek) {
    const firstInWeek = firstInWeekByUser.get(user.user_id);
    const lastInWeek = lastInWeekByUser.get(user.user_id);
    const overallStats = overallByUser.get(user.user_id);
    const goalInfo = goalSnippets.get(user.user_id);

    let totalDelta: number | null = null;
    if (overallStats && overallStats.totalEntries >= 2) {
      totalDelta = overallStats.lastWeight - overallStats.firstWeight;
      sumTotalDelta += totalDelta;
    }

    let weekDelta: number | null = null;
    if (
      firstInWeek &&
      lastInWeek &&
      firstInWeek.date !== lastInWeek.date
    ) {
      weekDelta = lastInWeek.weight_kg - firstInWeek.weight_kg;
      sumWeekDelta += weekDelta;
      countWithDelta++;
      if (weekDelta > 0) hasRegressions = true;
    }

    const streakIcon = getStreakIcon(streakLengths.get(user.user_id) ?? 0);
    let name = streakIcon ? `${user.display_name} ${streakIcon}` : user.display_name;
    if (crownUserId != null && user.user_id === crownUserId) name = "👑 " + name;
    submitted.push({
      name,
      dayDelta: weekDelta,
      totalDelta,
      goalRemaining: goalInfo?.remaining,
      goalPercent: goalInfo?.percent,
      goalReached: goalInfo?.reached,
    });

    if (weekDelta !== null && (leaderCandidate === null || weekDelta < leaderCandidate.dayDelta)) {
      leaderCandidate = { name, dayDelta: weekDelta, userId: user.user_id };
    }

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

  const leader = leaderCandidate
    ? { name: leaderCandidate.name, dayDelta: leaderCandidate.dayDelta, userId: leaderCandidate.userId }
    : undefined;

  return {
    date: formatDateRu(today),
    kind: "weekly",
    submitted,
    missing,
    hasRegressions,
    sumDayDelta: Math.round(sumWeekDelta * 10) / 10,
    sumTotalDelta: Math.round(sumTotalDelta * 10) / 10,
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
    crownHolderName: leader?.name ?? undefined,
  };
}
