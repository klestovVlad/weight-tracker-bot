CREATE TABLE IF NOT EXISTS reminders_sent (
  user_id INTEGER NOT NULL,
  date TEXT NOT NULL,
  sent_at TEXT NOT NULL,
  PRIMARY KEY (user_id, date)
);
