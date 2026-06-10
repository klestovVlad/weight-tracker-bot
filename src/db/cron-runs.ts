export interface JobStatus {
  job: string;
  status: string;
  startedAt: string;
}

/** Latest run status per job (most recent first). For the admin dashboard. */
export async function getRecentJobStatuses(db: D1Database): Promise<JobStatus[]> {
  const result = await db
    .prepare(
      `SELECT job, status, started_at
       FROM cron_runs
       ORDER BY started_at DESC
       LIMIT 50`,
    )
    .all<{ job: string; status: string; started_at: string }>();

  const latestByJob = new Map<string, JobStatus>();
  for (const row of result.results ?? []) {
    if (!latestByJob.has(row.job)) {
      latestByJob.set(row.job, {
        job: row.job,
        status: row.status,
        startedAt: row.started_at,
      });
    }
  }
  return [...latestByJob.values()];
}
