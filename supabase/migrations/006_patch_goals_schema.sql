-- Patch existing `goals` table to match the app schema (safe for existing databases)
-- Fixes PostgREST schema cache errors like:
-- "Could not find the 'level' column of 'goals' in the schema cache"
--
-- This migration assumes the `goals` table already exists, but may be missing columns.
-- If you have no `goals` table at all, run `001_initial_schema.sql` first.

ALTER TABLE goals
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS level TEXT NOT NULL DEFAULT 'milestone',
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'not-started',
  ADD COLUMN IF NOT EXISTS progress INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS month INTEGER,
  ADD COLUMN IF NOT EXISTS year INTEGER,
  ADD COLUMN IF NOT EXISTS due_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS start_time TEXT,
  ADD COLUMN IF NOT EXISTS end_time TEXT,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_worked_on TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS subtasks JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS notes JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS time_log JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS parent_id UUID,
  ADD COLUMN IF NOT EXISTS parent_level TEXT;

-- Backfill month/year for existing rows if missing.
-- Uses created_at when available, otherwise current date.
UPDATE goals
SET
  month = COALESCE(month, EXTRACT(MONTH FROM COALESCE(created_at, NOW()))::int),
  year = COALESCE(year, EXTRACT(YEAR FROM COALESCE(created_at, NOW()))::int)
WHERE month IS NULL OR year IS NULL;

