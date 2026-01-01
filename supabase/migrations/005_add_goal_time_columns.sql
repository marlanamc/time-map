-- Add missing time fields to goals table (safe for existing databases)
-- This fixes PostgREST schema cache errors like:
-- "Could not find the 'end_time' column of 'goals' in the schema cache"

ALTER TABLE goals
  ADD COLUMN IF NOT EXISTS start_time TEXT,
  ADD COLUMN IF NOT EXISTS end_time TEXT;

