import { getGoal, getGoalsByUserIds, computeGoalProgress } from "../../db/goals";
import { getLastWeight } from "../../db/weights";
import type { OverallStats } from "../../db/weights";
import type { ReportUserDelta } from "../../types";
import { formatGoalSnippet } from "../goal";

/** Participant with best (most negative) dayDelta in the period. Returns null if no one has dayDelta. */
export function getLeaderFromSubmitted(
  submitted: ReportUserDelta[],
): { name: string; dayDelta: number } | null {
  let best: { name: string; dayDelta: number } | null = null;
  for (const u of submitted) {
    if (u.dayDelta === null) continue;
    if (best === null || u.dayDelta < best.dayDelta) {
      best = { name: u.name, dayDelta: u.dayDelta };
    }
  }
  return best;
}

export function formatDateRu(dateStr: string): string {
  const [year, month, day] = dateStr.split("-");
  return `${day}.${month}.${year}`;
}

export function isLastDayOfMonth(dateStr: string): boolean {
  const date = new Date(dateStr + "T12:00:00Z");
  const nextDay = new Date(date);
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);
  return nextDay.getUTCDate() === 1;
}

export interface GoalSnippet {
  snippet: string;
  remaining: number;
  percent: number;
  reached: boolean;
}

export async function getGoalSnippetForUser(
  db: D1Database,
  userId: number,
): Promise<GoalSnippet | null> {
  const goal = await getGoal(db, userId);
  if (!goal) return null;

  const lastWeight = await getLastWeight(db, userId);
  if (!lastWeight) return null;

  const progress = computeGoalProgress(goal, lastWeight.weight_kg);
  const snippet = formatGoalSnippet(
    progress.remainingKg,
    progress.percent,
    progress.reached,
  );

  return {
    snippet,
    remaining: progress.remainingKg,
    percent: progress.percent,
    reached: progress.reached,
  };
}

/** Batch goal snippets: goals + overall last weight per user, then compute in memory. */
export async function getGoalSnippetsByUsers(
  db: D1Database,
  userIds: number[],
  overallByUser: Map<number, OverallStats>,
): Promise<Map<number, GoalSnippet>> {
  const map = new Map<number, GoalSnippet>();
  if (userIds.length === 0) return map;
  const goals = await getGoalsByUserIds(db, userIds);
  for (const userId of userIds) {
    const goal = goals.get(userId);
    const overall = overallByUser.get(userId);
    if (!goal || !overall) continue;
    const progress = computeGoalProgress(goal, overall.lastWeight);
    const snippet = formatGoalSnippet(
      progress.remainingKg,
      progress.percent,
      progress.reached,
    );
    map.set(userId, {
      snippet,
      remaining: progress.remainingKg,
      percent: progress.percent,
      reached: progress.reached,
    });
  }
  return map;
}
