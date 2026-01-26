-- Add intention linking and start date columns to goals table
-- Supports recurring intentions linked to parent goals (vision/milestone/focus)

ALTER TABLE goals
ADD COLUMN IF NOT EXISTS start_date DATE,
ADD COLUMN IF NOT EXISTS link_target JSONB;

-- Comments for documentation
COMMENT ON COLUMN goals.start_date IS 'The date when this intention first occurs (typically the first occurrence of the selected days)';

COMMENT ON COLUMN goals.link_target IS 'Reference to the parent goal this intention is linked to: { type: "vision" | "milestone" | "focus", id: "uuid" }';

-- Index for querying intentions by linked parent
CREATE INDEX IF NOT EXISTS idx_goals_link_target_id ON goals USING GIN (link_target) WHERE link_target IS NOT NULL;

-- Index for querying by start_date (useful for showing future intentions)
CREATE INDEX IF NOT EXISTS idx_goals_start_date ON goals(start_date) WHERE start_date IS NOT NULL;
