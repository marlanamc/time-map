-- Initial Database Schema for Garden Fence App
-- Creates all tables needed for the vision board application
-- Run this via Supabase dashboard: SQL Editor → New Query → Paste this → Run

-- =============================================================================
-- Goals Table
-- =============================================================================
CREATE TABLE IF NOT EXISTS goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    level TEXT NOT NULL DEFAULT 'milestone',
    category TEXT,
    priority TEXT NOT NULL DEFAULT 'medium',
    status TEXT NOT NULL DEFAULT 'not-started',
    progress INTEGER NOT NULL DEFAULT 0,
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    due_date TIMESTAMPTZ,
    start_time TEXT,
    end_time TEXT,
    completed_at TIMESTAMPTZ,
    last_worked_on TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    subtasks JSONB DEFAULT '[]'::jsonb,
    notes JSONB DEFAULT '[]'::jsonb,
    time_log JSONB DEFAULT '[]'::jsonb,
    tags TEXT[] DEFAULT ARRAY[]::TEXT[],
    parent_id UUID REFERENCES goals(id) ON DELETE SET NULL,
    parent_level TEXT
);

-- =============================================================================
-- Brain Dump Table
-- =============================================================================
CREATE TABLE IF NOT EXISTS brain_dump (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed BOOLEAN NOT NULL DEFAULT FALSE,
    archived BOOLEAN NOT NULL DEFAULT FALSE,
    processed_action TEXT,
    processed_at TIMESTAMPTZ
);

-- =============================================================================
-- Preferences Table
-- =============================================================================
CREATE TABLE IF NOT EXISTS preferences (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- Achievements Table
-- =============================================================================
CREATE TABLE IF NOT EXISTS achievements (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    achievement_id TEXT NOT NULL,
    unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, achievement_id)
);

-- =============================================================================
-- Weekly Reviews Table
-- =============================================================================
CREATE TABLE IF NOT EXISTS weekly_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    week_start DATE NOT NULL,
    week_end DATE NOT NULL,
    goals_completed INTEGER NOT NULL DEFAULT 0,
    time_spent INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    wins TEXT[] DEFAULT ARRAY[]::TEXT[],
    challenges TEXT[] DEFAULT ARRAY[]::TEXT[],
    learnings TEXT[] DEFAULT ARRAY[]::TEXT[],
    next_week_priorities TEXT[] DEFAULT ARRAY[]::TEXT[],
    mood TEXT,
    energy_avg INTEGER
);

-- =============================================================================
-- Body Double Sessions Table
-- =============================================================================
CREATE TABLE IF NOT EXISTS body_double_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    duration INTEGER NOT NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    goal_id UUID REFERENCES goals(id) ON DELETE SET NULL,
    completed BOOLEAN NOT NULL DEFAULT FALSE
);

-- =============================================================================
-- Indexes for Foreign Keys and Common Queries
-- =============================================================================

-- Goals indexes
CREATE INDEX IF NOT EXISTS idx_goals_user_id ON goals(user_id);
CREATE INDEX IF NOT EXISTS idx_goals_parent_id ON goals(parent_id) WHERE parent_id IS NOT NULL;

-- Brain dump indexes
CREATE INDEX IF NOT EXISTS idx_brain_dump_user_id ON brain_dump(user_id);
CREATE INDEX IF NOT EXISTS idx_brain_dump_created_at ON brain_dump(created_at DESC);

-- Achievements indexes
CREATE INDEX IF NOT EXISTS idx_achievements_user_id ON achievements(user_id);

-- Weekly reviews indexes
CREATE INDEX IF NOT EXISTS idx_weekly_reviews_user_id ON weekly_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_weekly_reviews_week_start ON weekly_reviews(week_start DESC);

-- Body double sessions indexes
CREATE INDEX IF NOT EXISTS idx_body_double_user_id ON body_double_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_body_double_goal_id ON body_double_sessions(goal_id) WHERE goal_id IS NOT NULL;

-- =============================================================================
-- Comments for Documentation
-- =============================================================================
COMMENT ON TABLE goals IS 'Goals, intentions, and milestones for the vision board';
COMMENT ON TABLE brain_dump IS 'Quick capture entries for thoughts and ideas';
COMMENT ON TABLE preferences IS 'User preferences stored as JSONB';
COMMENT ON TABLE achievements IS 'Unlocked achievements by user';
COMMENT ON TABLE weekly_reviews IS 'Weekly review and reflection entries';
COMMENT ON TABLE body_double_sessions IS 'Body double session tracking';

