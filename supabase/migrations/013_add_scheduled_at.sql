-- Add scheduled_at column to goals table
-- This column stores the exact date/time when a goal is scheduled on the timeline
-- Used to persist drag-and-drop scheduling in the day view

ALTER TABLE goals
  ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;

-- Add index for efficient queries by scheduled date
CREATE INDEX IF NOT EXISTS idx_goals_scheduled_at ON goals(scheduled_at) WHERE scheduled_at IS NOT NULL;

COMMENT ON COLUMN goals.scheduled_at IS 'Exact date/time when goal is scheduled on timeline (for day view drag-and-drop)';
