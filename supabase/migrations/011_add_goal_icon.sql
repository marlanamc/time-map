-- Add icon column to goals table for vision emoji support
-- This allows storing emoji icons for visions and other goals

ALTER TABLE goals
  ADD COLUMN IF NOT EXISTS icon TEXT;

-- Add index for queries filtering by icon (though likely not needed, added for completeness)
-- CREATE INDEX IF NOT EXISTS idx_goals_icon ON goals(icon) WHERE icon IS NOT NULL;

COMMENT ON COLUMN goals.icon IS 'Optional emoji icon for the goal, primarily used for visions';
