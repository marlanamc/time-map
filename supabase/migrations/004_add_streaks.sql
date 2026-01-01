-- Add streaks table for cross-device sync
-- Run this via Supabase dashboard or CLI: supabase migration up

CREATE TABLE IF NOT EXISTS streaks (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    count INTEGER NOT NULL DEFAULT 0,
    last_date TIMESTAMPTZ,
    best_streak INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE streaks ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (allows re-running this migration)
DROP POLICY IF EXISTS "Users can view their own streaks" ON streaks;
DROP POLICY IF EXISTS "Users can create their own streaks" ON streaks;
DROP POLICY IF EXISTS "Users can update their own streaks" ON streaks;

-- Policies
CREATE POLICY "Users can view their own streaks"
    ON streaks
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own streaks"
    ON streaks
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own streaks"
    ON streaks
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE streaks IS 'User streak tracking for gamification';
