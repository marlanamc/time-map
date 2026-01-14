-- Adds an explicit activity identifier for goal emoji/activity tracking
ALTER TABLE goals
  ADD COLUMN IF NOT EXISTS activity_id TEXT;
