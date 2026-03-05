-- Weigh-in frequency: daily (default) or weekly. Weekly users get reminded on Sunday only.
ALTER TABLE user_settings ADD COLUMN weigh_frequency TEXT DEFAULT 'daily';
