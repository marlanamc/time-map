-- Enable Row Level Security for events table and create policies
-- Run this AFTER running 007_add_events.sql

ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (allows re-running this migration)
DROP POLICY IF EXISTS "Users can view their own events" ON events;
DROP POLICY IF EXISTS "Users can create their own events" ON events;
DROP POLICY IF EXISTS "Users can update their own events" ON events;
DROP POLICY IF EXISTS "Users can delete their own events" ON events;

CREATE POLICY "Users can view their own events"
    ON events
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own events"
    ON events
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own events"
    ON events
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own events"
    ON events
    FOR DELETE
    USING (auth.uid() = user_id);

