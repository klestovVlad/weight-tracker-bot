-- Cron job tracking for idempotency
CREATE TABLE IF NOT EXISTS cron_runs (
  job TEXT NOT NULL,
  date TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  status TEXT,
  info TEXT,
  PRIMARY KEY (job, date)
);

-- Rate limiting for anti-spam
CREATE TABLE IF NOT EXISTS rate_limits (
  user_id INTEGER NOT NULL,
  key TEXT NOT NULL,
  window_start TEXT NOT NULL,
  count INTEGER NOT NULL,
  PRIMARY KEY (user_id, key)
);
