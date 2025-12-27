-- Performance Optimization Migration
-- Adds composite indexes and GIN indexes for JSONB columns
-- Run this via Supabase dashboard or CLI: supabase migration up

-- =============================================================================
-- Goals Table Indexes
-- =============================================================================

-- Common query patterns: Get goals by user and status
CREATE INDEX IF NOT EXISTS idx_goals_user_status
  ON goals(user_id, status);

-- Monthly view: Get goals by user, month, and year
CREATE INDEX IF NOT EXISTS idx_goals_user_month_year
  ON goals(user_id, month, year);

-- Priority view: Get goals by user, status, and priority
CREATE INDEX IF NOT EXISTS idx_goals_user_status_priority
  ON goals(user_id, status, priority);

-- "Continue where you left off": Recently worked goals
CREATE INDEX IF NOT EXISTS idx_goals_last_worked_on
  ON goals(user_id, last_worked_on DESC NULLS LAST);

-- Due date filtering: Overdue and upcoming goals
CREATE INDEX IF NOT EXISTS idx_goals_due_date
  ON goals(user_id, due_date)
  WHERE due_date IS NOT NULL;

-- Partial index for active goals only (most frequently queried)
CREATE INDEX IF NOT EXISTS idx_goals_active
  ON goals(user_id, updated_at DESC)
  WHERE status IN ('not-started', 'in-progress', 'blocked');

-- Completed goals for stats and achievements
CREATE INDEX IF NOT EXISTS idx_goals_completed
  ON goals(user_id, completed_at DESC)
  WHERE status = 'done' AND completed_at IS NOT NULL;

-- =============================================================================
-- JSONB Indexes for Goals
-- =============================================================================

-- GIN index for timeLog JSONB queries
-- Allows fast queries like: WHERE time_log @> '[{"date": "2024-01-15"}]'
CREATE INDEX IF NOT EXISTS idx_goals_time_log_gin
  ON goals USING GIN(time_log);

-- GIN index for subtasks JSONB queries
-- Allows fast queries like: WHERE subtasks @> '[{"done": false}]'
CREATE INDEX IF NOT EXISTS idx_goals_subtasks_gin
  ON goals USING GIN(subtasks);

-- GIN index for notes JSONB queries (if searching notes)
CREATE INDEX IF NOT EXISTS idx_goals_notes_gin
  ON goals USING GIN(notes);

-- =============================================================================
-- Brain Dump Indexes
-- =============================================================================

-- Get unprocessed brain dump entries
CREATE INDEX IF NOT EXISTS idx_brain_dump_user_processed
  ON brain_dump(user_id, processed, created_at DESC);

-- Get archived brain dump entries
CREATE INDEX IF NOT EXISTS idx_brain_dump_user_archived
  ON brain_dump(user_id, archived, created_at DESC)
  WHERE archived = true;

-- Full text search on brain dump text (if needed)
-- Uncomment if you want to enable full-text search:
-- CREATE INDEX IF NOT EXISTS idx_brain_dump_text_search
--   ON brain_dump USING GIN(to_tsvector('english', text));

-- =============================================================================
-- Weekly Reviews Indexes
-- =============================================================================

-- Get reviews by user and date range
CREATE INDEX IF NOT EXISTS idx_weekly_reviews_user_week
  ON weekly_reviews(user_id, week_start DESC, week_end DESC);

-- =============================================================================
-- Body Double Sessions Indexes
-- =============================================================================

-- Get sessions by user and completion status
CREATE INDEX IF NOT EXISTS idx_body_double_user_completed
  ON body_double_sessions(user_id, completed, started_at DESC);

-- Get sessions for a specific goal
CREATE INDEX IF NOT EXISTS idx_body_double_user_goal
  ON body_double_sessions(user_id, goal_id, started_at DESC)
  WHERE goal_id IS NOT NULL;

-- =============================================================================
-- Achievements Indexes
-- =============================================================================

-- Get achievements by user and unlock date
CREATE INDEX IF NOT EXISTS idx_achievements_user_unlocked
  ON achievements(user_id, unlocked_at DESC);

-- =============================================================================
-- Preferences Indexes
-- =============================================================================

-- Preferences lookup by user (should already have PK, but ensure it's optimized)
CREATE INDEX IF NOT EXISTS idx_preferences_user
  ON preferences(user_id);

-- =============================================================================
-- Expression Indexes for Common Queries
-- =============================================================================

-- Overdue goals (goals past due date that aren't done)
CREATE INDEX IF NOT EXISTS idx_goals_overdue
  ON goals(user_id, due_date)
  WHERE status != 'done' AND due_date < NOW();

-- Goals by category
CREATE INDEX IF NOT EXISTS idx_goals_user_category
  ON goals(user_id, category, updated_at DESC);

-- =============================================================================
-- Performance Analysis
-- =============================================================================

-- To analyze query performance after adding indexes, run:
-- EXPLAIN ANALYZE SELECT * FROM goals WHERE user_id = 'xxx' AND status = 'in-progress';

-- To check index usage:
-- SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
-- FROM pg_stat_user_indexes
-- WHERE schemaname = 'public'
-- ORDER BY idx_scan DESC;

-- To find missing indexes:
-- SELECT schemaname, tablename, seq_scan, seq_tup_read,
--        seq_tup_read / seq_scan AS avg_seq_tup_read
-- FROM pg_stat_user_tables
-- WHERE seq_scan > 0
-- ORDER BY seq_tup_read DESC
-- LIMIT 10;

COMMENT ON TABLE goals IS 'Vision board goals with optimized indexes for ADHD-friendly performance';
COMMENT ON TABLE brain_dump IS 'Quick capture brain dump entries with search indexes';
