-- Pending actions table: stores temporary user actions (like edit mode)
CREATE TABLE IF NOT EXISTS pending_actions (
    user_id INTEGER PRIMARY KEY,
    action TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
);
