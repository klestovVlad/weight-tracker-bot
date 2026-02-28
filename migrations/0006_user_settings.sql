CREATE TABLE IF NOT EXISTS user_settings (
  user_id INTEGER PRIMARY KEY,
  vacation_until TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
