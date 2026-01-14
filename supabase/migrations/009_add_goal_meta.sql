-- Adds a structured `meta` column for goals
ALTER TABLE goals
  ADD COLUMN IF NOT EXISTS meta JSONB DEFAULT '{}'::jsonb;
