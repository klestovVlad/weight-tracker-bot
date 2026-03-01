export interface Goal {
  user_id: number;
  target_weight_kg: number;
  start_weight_kg: number;
  created_at: string;
  updated_at: string;
}

export interface GoalProgress {
  targetWeight: number;
  startWeight: number;
  currentWeight: number;
  remainingKg: number;
  percent: number;
  reached: boolean;
  direction: "lose" | "gain";
}

export async function getGoal(db: D1Database, userId: number): Promise<Goal | null> {
  const row = await db
    .prepare("SELECT * FROM goals WHERE user_id = ?")
    .bind(userId)
    .first<Goal>();
  return row || null;
}

export async function upsertGoal(
  db: D1Database,
  userId: number,
  targetWeightKg: number,
  startWeightKg: number
): Promise<void> {
  const now = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO goals (user_id, target_weight_kg, start_weight_kg, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         target_weight_kg = excluded.target_weight_kg,
         start_weight_kg = excluded.start_weight_kg,
         updated_at = excluded.updated_at`
    )
    .bind(userId, targetWeightKg, startWeightKg, now, now)
    .run();
}

export async function deleteGoal(db: D1Database, userId: number): Promise<void> {
  await db.prepare("DELETE FROM goals WHERE user_id = ?").bind(userId).run();
}

export function computeGoalProgress(
  goal: Goal,
  currentWeight: number
): GoalProgress {
  const { target_weight_kg: target, start_weight_kg: start } = goal;

  if (target === start) {
    return {
      targetWeight: target,
      startWeight: start,
      currentWeight,
      remainingKg: 0,
      percent: 100,
      reached: true,
      direction: "lose",
    };
  }

  const isLosing = target < start;

  let remaining: number;
  let progress: number;

  if (isLosing) {
    remaining = Math.max(0, currentWeight - target);
    progress = (start - currentWeight) / (start - target);
  } else {
    remaining = Math.max(0, target - currentWeight);
    progress = (currentWeight - start) / (target - start);
  }

  progress = Math.max(0, Math.min(1, progress));
  const percent = Math.round(progress * 100);
  const reached = remaining === 0;

  return {
    targetWeight: target,
    startWeight: start,
    currentWeight,
    remainingKg: Math.round(remaining * 10) / 10,
    percent,
    reached,
    direction: isLosing ? "lose" : "gain",
  };
}

export function generateProgressBar(percent: number, length: number = 20): string {
  const filled = Math.round((percent / 100) * length);
  const empty = length - filled;
  return "█".repeat(filled) + "░".repeat(empty);
}
