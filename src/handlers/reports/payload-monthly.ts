import { Env, ReportPayload, ReportUserDelta, ReportGoalsInfo } from "../../types";
import { getTodayDate, getStreakIcon } from "../../utils";
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
import { formatDateRu, getGoalSnippetsByUsers, getLeaderFromSubmitted } from "./helpers";

export async function buildMonthlyPayload(
  env: Env,
): Promise<ReportPayload | null> {
  const today = getTodayDate();
  const [year, month] = today.split("-").map(Number);
  const firstDayOfMonth = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDayOfMonth = today;

  const usersThisMonth = await getUsersWithWeightInRange(
    env.DB,
    firstDayOfMonth,
    lastDayOfMonth,
  );

  if (usersThisMonth.length === 0) return null;

  const userIds = usersThisMonth.map((u) => u.user_id);

  // First/last weight within month range (fixes firstInMonth fallback bug); overall stats for totalDelta.
  const [firstInRangeByUser, lastInRangeByUser, overallByUser, streakLengths] =
    await Promise.all([
      getFirstWeightInRangeByUsers(
        env.DB,
        firstDayOfMonth,
        lastDayOfMonth,
        userIds,
      ),
      getLastWeightInRangeByUsers(
        env.DB,
        firstDayOfMonth,
        lastDayOfMonth,
        userIds,
      ),
      getOverallFirstAndLastByUsers(env.DB, userIds),
      getUserStreakLengthsByUsers(env.DB, userIds),
    ]);

  const [goalSnippets, crownUserId] = await Promise.all([
    getGoalSnippetsByUsers(env.DB, userIds, overallByUser),
    getCrownUserId(env.DB),
  ]);

  const submitted: ReportUserDelta[] = [];
  const goalsInfo: ReportGoalsInfo[] = [];
  let sumMonthDelta = 0;
  let countWithDelta = 0;
  let hasRegressions = false;

  for (const user of usersThisMonth) {
    const firstInMonth = firstInRangeByUser.get(user.user_id);
    const lastInMonth = lastInRangeByUser.get(user.user_id);
    const overallStats = overallByUser.get(user.user_id);
    const goalInfo = goalSnippets.get(user.user_id);

    let totalDelta: number | null = null;
    if (overallStats && overallStats.totalEntries >= 2) {
      totalDelta = overallStats.lastWeight - overallStats.firstWeight;
    }

    let monthDelta: number | null = null;
    if (
      firstInMonth &&
      lastInMonth &&
      firstInMonth.date !== lastInMonth.date
    ) {
      monthDelta = lastInMonth.weight_kg - firstInMonth.weight_kg;
      sumMonthDelta += monthDelta;
      countWithDelta++;
      if (monthDelta > 0) hasRegressions = true;
    }

    const streakIcon = getStreakIcon(streakLengths.get(user.user_id) ?? 0);
    let name = streakIcon ? `${user.display_name} ${streakIcon}` : user.display_name;
    if (crownUserId != null && user.user_id === crownUserId) name = "👑 " + name;
    submitted.push({
      name,
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

  const [allUsers, vacationUserIds] = await Promise.all([
    getAllUsers(env.DB),
    getUsersOnVacation(env.DB, today),
  ]);
  const submittedIds = new Set(usersThisMonth.map((u) => u.user_id));
  const vacationSet = new Set(vacationUserIds);
  const missing = allUsers
    .filter(
      (u) => !submittedIds.has(u.user_id) && !vacationSet.has(u.user_id),
    )
    .map((u) => u.display_name);

  const leader = getLeaderFromSubmitted(submitted);
  const crownHolderName =
    crownUserId != null
      ? allUsers.find((u) => u.user_id === crownUserId)?.display_name ?? undefined
      : undefined;

  return {
    date: formatDateRu(today),
    kind: "monthly",
    submitted,
    missing,
    hasRegressions,
    sumDayDelta: Math.round(sumMonthDelta * 10) / 10,
    avgDayDelta:
      countWithDelta > 0
        ? Math.round((sumMonthDelta / countWithDelta) * 100) / 100
        : 0,
    firstEntryCount: 0,
    firstEntryNames: [],
    goalsInfo: goalsInfo.length > 0 ? goalsInfo : undefined,
    countSubmitted: submitted.length,
    countMissing: missing.length,
    leader: leader ?? undefined,
    crownHolderName: crownHolderName ?? undefined,
  };
}
