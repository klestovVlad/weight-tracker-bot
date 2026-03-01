-- Goals table for target weight tracking
CREATE TABLE IF NOT EXISTS goals (
  user_id INTEGER PRIMARY KEY,
  target_weight_kg REAL NOT NULL,
  start_weight_kg REAL NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
