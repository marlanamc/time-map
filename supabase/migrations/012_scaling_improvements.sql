-- Scaling Improvements Migration
-- Addresses potential issues for high user counts
-- Run this via Supabase dashboard or CLI: supabase migration up

-- =============================================================================
-- 1. Add CHECK constraints for data integrity on goals.level and goals.status
-- =============================================================================

-- Level constraint: ensures only valid goal hierarchy levels
ALTER TABLE goals
  DROP CONSTRAINT IF EXISTS check_goal_level;

ALTER TABLE goals
  ADD CONSTRAINT check_goal_level 
  CHECK (level IN ('vision', 'milestone', 'focus', 'intention', 'task', 'event'));

-- Status constraint: ensures only valid statuses
ALTER TABLE goals
  DROP CONSTRAINT IF EXISTS check_goal_status;

ALTER TABLE goals
  ADD CONSTRAINT check_goal_status 
  CHECK (status IN ('not-started', 'in-progress', 'blocked', 'done', 'cancelled', 'archived'));

-- Priority constraint: ensures only valid priorities
ALTER TABLE goals
  DROP CONSTRAINT IF EXISTS check_goal_priority;

ALTER TABLE goals
  ADD CONSTRAINT check_goal_priority 
  CHECK (priority IN ('low', 'medium', 'high', 'urgent'));

-- =============================================================================
-- 2. Archival Strategy - Add archived_at columns for soft deletes
-- =============================================================================

-- Goals archival (for completed goals cleanup without data loss)
ALTER TABLE goals
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

-- Create partial index for non-archived goals (most common query pattern)
CREATE INDEX IF NOT EXISTS idx_goals_user_not_archived
  ON goals(user_id, updated_at DESC)
  WHERE archived_at IS NULL;

-- Index for archived goals (less common, for history views)
CREATE INDEX IF NOT EXISTS idx_goals_user_archived
  ON goals(user_id, archived_at DESC)
  WHERE archived_at IS NOT NULL;

-- Events archival (for old events cleanup)
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_events_user_not_archived
  ON events(user_id, start_at)
  WHERE archived_at IS NULL;

-- Brain dump archival tracking (already has 'archived' boolean, add timestamp)
ALTER TABLE brain_dump
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

-- Weekly reviews archival (for very old reviews)
ALTER TABLE weekly_reviews
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

-- =============================================================================
-- 3. Preferences - Add common settings as indexed columns
-- =============================================================================
-- Breaking out frequently-queried settings from the JSONB blob
-- This allows filtering users by settings if needed (e.g., push notifications)

ALTER TABLE preferences
  ADD COLUMN IF NOT EXISTS theme TEXT DEFAULT 'auto',
  ADD COLUMN IF NOT EXISTS notifications_enabled BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS timezone TEXT;

-- Index for users who have notifications enabled (for batch push sends)
CREATE INDEX IF NOT EXISTS idx_preferences_notifications
  ON preferences(notifications_enabled)
  WHERE notifications_enabled = TRUE;

-- =============================================================================
-- 4. Weekly Reviews Uniqueness Constraint (if not already added)
-- =============================================================================
-- Prevents duplicate reviews for the same week

-- First, remove any duplicates if they exist
DELETE FROM weekly_reviews a
  USING weekly_reviews b
  WHERE a.id > b.id
    AND a.user_id = b.user_id
    AND a.week_start = b.week_start;

-- Now add the constraint
ALTER TABLE weekly_reviews
  DROP CONSTRAINT IF EXISTS unique_user_week_start;

ALTER TABLE weekly_reviews
  ADD CONSTRAINT unique_user_week_start UNIQUE(user_id, week_start);

-- =============================================================================
-- 5. Events - Better composite indexes for calendar queries
-- =============================================================================

-- Range query optimization for calendar views
CREATE INDEX IF NOT EXISTS idx_events_user_date_range
  ON events(user_id, start_at, end_at);

-- All-day events quick lookup
CREATE INDEX IF NOT EXISTS idx_events_user_all_day
  ON events(user_id, start_at)
  WHERE all_day = TRUE;

-- =============================================================================
-- 6. Streaks - Add missing DELETE policy
-- =============================================================================

DROP POLICY IF EXISTS "Users can delete their own streaks" ON streaks;

CREATE POLICY "Users can delete their own streaks"
    ON streaks
    FOR DELETE
    USING (auth.uid() = user_id);

-- =============================================================================
-- 7. Add row count estimates for monitoring (optional helper function)
-- =============================================================================

-- Function to get table sizes for monitoring (optional - run manually if needed)
-- SELECT 
--   relname AS table_name,
--   reltuples::bigint AS row_estimate,
--   pg_size_pretty(pg_total_relation_size(relid)) AS total_size
-- FROM pg_stat_user_tables
-- WHERE schemaname = 'public'
-- ORDER BY pg_total_relation_size(relid) DESC;

-- =============================================================================
-- 8. Add updated_at trigger for preferences (consistency)
-- =============================================================================

-- Create or replace the trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop if exists and recreate for preferences
DROP TRIGGER IF EXISTS update_preferences_updated_at ON preferences;
CREATE TRIGGER update_preferences_updated_at
    BEFORE UPDATE ON preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add to goals as well
DROP TRIGGER IF EXISTS update_goals_updated_at ON goals;
CREATE TRIGGER update_goals_updated_at
    BEFORE UPDATE ON goals
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add to events
DROP TRIGGER IF EXISTS update_events_updated_at ON events;
CREATE TRIGGER update_events_updated_at
    BEFORE UPDATE ON events
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add to streaks
DROP TRIGGER IF EXISTS update_streaks_updated_at ON streaks;
CREATE TRIGGER update_streaks_updated_at
    BEFORE UPDATE ON streaks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- Documentation
-- =============================================================================

COMMENT ON COLUMN goals.archived_at IS 'Timestamp when goal was archived (soft delete). NULL = active.';
COMMENT ON COLUMN events.archived_at IS 'Timestamp when event was archived. NULL = active.';
COMMENT ON COLUMN preferences.theme IS 'Extracted user theme preference for indexed queries.';
COMMENT ON COLUMN preferences.notifications_enabled IS 'Whether push notifications are enabled.';
COMMENT ON COLUMN preferences.timezone IS 'User timezone for notification scheduling.';

