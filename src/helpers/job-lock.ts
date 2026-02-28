import { Env } from "../types";
import { logInfo, logError } from "./logging";

export interface JobResult {
  skipped: boolean;
  error?: string;
}

export async function withJobLock(
  env: Env,
  jobName: string,
  dateKey: string,
  fn: () => Promise<void>
): Promise<JobResult> {
  try {
    await env.DB
      .prepare(
        `INSERT INTO cron_runs (job, date, started_at, status)
         VALUES (?, ?, datetime('now'), 'running')`
      )
      .bind(jobName, dateKey)
      .run();
  } catch {
    logInfo(`Job ${jobName}/${dateKey} already running or completed, skipping`);
    return { skipped: true };
  }

  try {
    await fn();

    await env.DB
      .prepare(
        `UPDATE cron_runs
         SET finished_at = datetime('now'), status = 'ok'
         WHERE job = ? AND date = ?`
      )
      .bind(jobName, dateKey)
      .run();

    return { skipped: false };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    const truncatedError = errorMsg.slice(0, 500);

    await env.DB
      .prepare(
        `UPDATE cron_runs
         SET finished_at = datetime('now'), status = 'error', info = ?
         WHERE job = ? AND date = ?`
      )
      .bind(truncatedError, jobName, dateKey)
      .run();

    logError(`Job ${jobName}/${dateKey} failed`, error);
    return { skipped: false, error: truncatedError };
  }
}

export function getWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}
