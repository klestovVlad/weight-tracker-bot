export interface Season {
  id: number;
  name: string;
  start_date: string;
  end_date: string;
  goal_kg: number | null;
  created_at: string;
}

export async function createSeason(
  db: D1Database,
  name: string,
  startDate: string,
  endDate: string,
  goalKg: number | null,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO seasons (name, start_date, end_date, goal_kg, created_at)
       VALUES (?, ?, ?, ?, datetime('now'))`,
    )
    .bind(name, startDate, endDate, goalKg)
    .run();
}

/** The active season for `today` (started, not yet ended), most recent first. */
export async function getActiveSeason(
  db: D1Database,
  today: string,
): Promise<Season | null> {
  return db
    .prepare(
      `SELECT * FROM seasons
       WHERE start_date <= ? AND end_date >= ?
       ORDER BY id DESC
       LIMIT 1`,
    )
    .bind(today, today)
    .first<Season>();
}

/** Ends a season immediately by setting its end date to `today`. */
export async function endSeason(
  db: D1Database,
  id: number,
  today: string,
): Promise<void> {
  await db
    .prepare("UPDATE seasons SET end_date = ? WHERE id = ?")
    .bind(today, id)
    .run();
}
