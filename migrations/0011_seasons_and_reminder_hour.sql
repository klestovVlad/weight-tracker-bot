-- Seasons/challenges (D1) and per-user reminder hour (A4).
CREATE TABLE IF NOT EXISTS seasons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  goal_kg REAL,
  created_at TEXT NOT NULL
);

-- Local hour (0-23, Asia/Nicosia) at which to remind this user. Default 11 keeps current behavior.
ALTER TABLE user_settings ADD COLUMN reminder_hour INTEGER DEFAULT 11;
