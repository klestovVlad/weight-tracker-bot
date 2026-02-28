-- Weights table: stores user weight entries (one per day per user)
CREATE TABLE IF NOT EXISTS weights (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    weight_kg REAL NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_weights_user_date ON weights(user_id, date DESC);
