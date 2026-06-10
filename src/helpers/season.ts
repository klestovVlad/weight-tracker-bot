import { Env } from "../types";
import type { Season } from "../db/seasons";
import {
  getUsersWithWeightInRange,
  getFirstWeightInRangeByUsers,
  getLastWeightInRangeByUsers,
} from "../db/weights";
import { getDaysBetween } from "../utils";

export interface SeasonSetup {
  name: string;
  days: number;
  goalKg: number | null;
}

/**
 * Parses owner input "Название | дни | цель_кг" (goal optional).
 * Returns null if invalid. Pure / testable.
 */
export function parseSeasonSetup(text: string): SeasonSetup | null {
  const parts = text.split("|").map((p) => p.trim());
  if (parts.length < 2 || parts.length > 3) return null;

  const name = parts[0];
  if (!name || name.length > 40) return null;

  const days = parseInt(parts[1], 10);
  if (Number.isNaN(days) || days < 1 || days > 365) return null;

  let goalKg: number | null = null;
  if (parts.length === 3 && parts[2] !== "") {
    const g = parseFloat(parts[2].replace(",", "."));
    if (Number.isNaN(g) || g <= 0 || g > 1000) return null;
    goalKg = Math.round(g * 10) / 10;
  }

  return { name, days, goalKg };
}

export interface SeasonProgress {
  daysLeft: number;
  /** Total kg the team lost since the season start (positive = lost). */
  teamLostKg: number;
  goalKg: number | null;
  /** Progress toward the goal, 0–100, or null if no goal. */
  percent: number | null;
}

/** Computes team weight lost during a season's window [start, today]. */
export async function computeSeasonProgress(
  env: Env,
  season: Season,
  today: string,
): Promise<SeasonProgress> {
  const end = season.end_date < today ? season.end_date : today;
  const users = await getUsersWithWeightInRange(env.DB, season.start_date, end);
  const userIds = users.map((u) => u.user_id);

  let teamLostKg = 0;
  if (userIds.length > 0) {
    const [firstByUser, lastByUser] = await Promise.all([
      getFirstWeightInRangeByUsers(env.DB, season.start_date, end, userIds),
      getLastWeightInRangeByUsers(env.DB, season.start_date, end, userIds),
    ]);
    for (const id of userIds) {
      const first = firstByUser.get(id);
      const last = lastByUser.get(id);
      if (first && last && first.date !== last.date) {
        teamLostKg += first.weight_kg - last.weight_kg; // positive = lost
      }
    }
  }
  teamLostKg = Math.round(teamLostKg * 10) / 10;

  const daysLeft = Math.max(0, getDaysBetween(today, season.end_date));
  const percent =
    season.goal_kg && season.goal_kg > 0
      ? Math.max(0, Math.min(100, Math.round((teamLostKg / season.goal_kg) * 100)))
      : null;

  return { daysLeft, teamLostKg, goalKg: season.goal_kg, percent };
}
