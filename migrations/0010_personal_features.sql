-- Personal features: optional height (for BMI) and weekly personal digest opt-out.
ALTER TABLE user_settings ADD COLUMN height_cm INTEGER;
ALTER TABLE user_settings ADD COLUMN digest_enabled INTEGER DEFAULT 1;
