-- Users table: stores Telegram users who interact with the bot
CREATE TABLE IF NOT EXISTS users (
    user_id INTEGER PRIMARY KEY,
    display_name TEXT,
    username TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Settings table: key-value storage for bot configuration
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
);
