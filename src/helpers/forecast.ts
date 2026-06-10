import { getDaysBetween, addDays } from "../utils";

export interface ForecastPoint {
  /** YYYY-MM-DD */
  date: string;
  weightKg: number;
}

export interface GoalForecast {
  /** Estimated date the goal is reached (YYYY-MM-DD). */
  etaDate: string;
  /** Whole days from `today` to the ETA (>= 0). */
  daysLeft: number;
  /** Modeled change per day (kg/day); negative = losing. */
  ratePerDay: number;
}

const MIN_POINTS = 3;
/** Ignore a trend slower than this (kg/day) — ETA would be implausibly far. */
const MIN_RATE = 0.005;
/** Cap the projection so we never promise a date years away. */
const MAX_DAYS = 730;

/**
 * Projects when a goal weight will be reached, using a least-squares fit over
 * recent entries. Returns null when there isn't enough data, the trend is flat,
 * or the trend moves away from the goal. Pure / testable.
 */
export function forecastGoalDate(
  entries: ForecastPoint[],
  targetKg: number,
  today: string,
): GoalForecast | null {
  if (entries.length < MIN_POINTS) return null;

  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const base = sorted[0].date;

  // Least-squares slope of weight over days-since-first-entry.
  const xs = sorted.map((e) => getDaysBetween(base, e.date));
  const ys = sorted.map((e) => e.weightKg);
  const n = xs.length;
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;

  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - meanX) * (ys[i] - meanY);
    den += (xs[i] - meanX) ** 2;
  }
  if (den === 0) return null;

  const ratePerDay = num / den;
  const current = ys[ys.length - 1];
  const remaining = targetKg - current;

  // Already at/past the goal.
  if (Math.abs(remaining) < 0.05) {
    return { etaDate: today, daysLeft: 0, ratePerDay };
  }
  // Flat trend, or moving the wrong way.
  if (Math.abs(ratePerDay) < MIN_RATE) return null;
  if (Math.sign(remaining) !== Math.sign(ratePerDay)) return null;

  const daysLeft = Math.ceil(remaining / ratePerDay);
  if (daysLeft <= 0 || daysLeft > MAX_DAYS) return null;

  return { etaDate: addDays(today, daysLeft), daysLeft, ratePerDay };
}
