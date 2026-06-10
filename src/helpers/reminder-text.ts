/** Personalized reminder selection — pure logic, kept separate so it's testable. */

export type ReminderKind = "onboarding" | "goal" | "streak" | "comeback" | "default";

export interface ReminderContext {
  frequency: "daily" | "weekly";
  /** Active streak length if the last entry was yesterday (i.e. at risk today); else 0. */
  streakAtRisk: number;
  /** Whole days since the last entry; null if the user has never logged. */
  daysSinceLast: number | null;
  /** Kg left to a personal goal; null if no goal or already reached. */
  goalRemainingKg: number | null;
}

/** Goal is "almost there" within this many kg. */
export const GOAL_NUDGE_KG = 2;
/** Considered "cold" / dropped off after this many days without an entry. */
export const COMEBACK_DAYS = 5;
/** Streak counts as a streak worth protecting from this length. */
export const STREAK_MIN = 3;

/**
 * Chooses which reminder message to send based on the user's state.
 * Priority: never-logged → close-to-goal → protect-streak → comeback → default.
 */
export function pickReminderKind(ctx: ReminderContext): ReminderKind {
  if (ctx.daysSinceLast === null) return "onboarding";
  if (
    ctx.goalRemainingKg !== null &&
    ctx.goalRemainingKg > 0 &&
    ctx.goalRemainingKg <= GOAL_NUDGE_KG
  ) {
    return "goal";
  }
  if (ctx.frequency === "daily" && ctx.streakAtRisk >= STREAK_MIN) return "streak";
  if (ctx.daysSinceLast >= COMEBACK_DAYS) return "comeback";
  return "default";
}
