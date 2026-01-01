-- Row Level Security (RLS) Policies for Garden Fence App
-- Enables RLS and creates policies allowing users to access only their own data
-- Run this via Supabase dashboard: SQL Editor → New Query → Paste this → Run
-- IMPORTANT: Run this AFTER running 001_initial_schema.sql

-- =============================================================================
-- Enable Row Level Security on All Tables
-- =============================================================================

ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE brain_dump ENABLE ROW LEVEL SECURITY;
ALTER TABLE preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE body_double_sessions ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- Goals Table Policies
-- =============================================================================

-- Drop existing policies if they exist (allows re-running this migration)
DROP POLICY IF EXISTS "Users can view their own goals" ON goals;
DROP POLICY IF EXISTS "Users can create their own goals" ON goals;
DROP POLICY IF EXISTS "Users can update their own goals" ON goals;
DROP POLICY IF EXISTS "Users can delete their own goals" ON goals;

-- Users can SELECT their own goals
CREATE POLICY "Users can view their own goals"
    ON goals
    FOR SELECT
    USING (auth.uid() = user_id);

-- Users can INSERT their own goals
CREATE POLICY "Users can create their own goals"
    ON goals
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can UPDATE their own goals
CREATE POLICY "Users can update their own goals"
    ON goals
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Users can DELETE their own goals
CREATE POLICY "Users can delete their own goals"
    ON goals
    FOR DELETE
    USING (auth.uid() = user_id);

-- =============================================================================
-- Brain Dump Table Policies
-- =============================================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own brain dump entries" ON brain_dump;
DROP POLICY IF EXISTS "Users can create their own brain dump entries" ON brain_dump;
DROP POLICY IF EXISTS "Users can update their own brain dump entries" ON brain_dump;
DROP POLICY IF EXISTS "Users can delete their own brain dump entries" ON brain_dump;

-- Users can SELECT their own brain dump entries
CREATE POLICY "Users can view their own brain dump entries"
    ON brain_dump
    FOR SELECT
    USING (auth.uid() = user_id);

-- Users can INSERT their own brain dump entries
CREATE POLICY "Users can create their own brain dump entries"
    ON brain_dump
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can UPDATE their own brain dump entries
CREATE POLICY "Users can update their own brain dump entries"
    ON brain_dump
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Users can DELETE their own brain dump entries
CREATE POLICY "Users can delete their own brain dump entries"
    ON brain_dump
    FOR DELETE
    USING (auth.uid() = user_id);

-- =============================================================================
-- Preferences Table Policies
-- =============================================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own preferences" ON preferences;
DROP POLICY IF EXISTS "Users can create their own preferences" ON preferences;
DROP POLICY IF EXISTS "Users can update their own preferences" ON preferences;
DROP POLICY IF EXISTS "Users can delete their own preferences" ON preferences;

-- Users can SELECT their own preferences
CREATE POLICY "Users can view their own preferences"
    ON preferences
    FOR SELECT
    USING (auth.uid() = user_id);

-- Users can INSERT their own preferences
CREATE POLICY "Users can create their own preferences"
    ON preferences
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can UPDATE their own preferences
CREATE POLICY "Users can update their own preferences"
    ON preferences
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Users can DELETE their own preferences
CREATE POLICY "Users can delete their own preferences"
    ON preferences
    FOR DELETE
    USING (auth.uid() = user_id);

-- =============================================================================
-- Achievements Table Policies
-- =============================================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own achievements" ON achievements;
DROP POLICY IF EXISTS "Users can create their own achievements" ON achievements;
DROP POLICY IF EXISTS "Users can update their own achievements" ON achievements;
DROP POLICY IF EXISTS "Users can delete their own achievements" ON achievements;

-- Users can SELECT their own achievements
CREATE POLICY "Users can view their own achievements"
    ON achievements
    FOR SELECT
    USING (auth.uid() = user_id);

-- Users can INSERT their own achievements
CREATE POLICY "Users can create their own achievements"
    ON achievements
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can UPDATE their own achievements
CREATE POLICY "Users can update their own achievements"
    ON achievements
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Users can DELETE their own achievements
CREATE POLICY "Users can delete their own achievements"
    ON achievements
    FOR DELETE
    USING (auth.uid() = user_id);

-- =============================================================================
-- Weekly Reviews Table Policies
-- =============================================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own weekly reviews" ON weekly_reviews;
DROP POLICY IF EXISTS "Users can create their own weekly reviews" ON weekly_reviews;
DROP POLICY IF EXISTS "Users can update their own weekly reviews" ON weekly_reviews;
DROP POLICY IF EXISTS "Users can delete their own weekly reviews" ON weekly_reviews;

-- Users can SELECT their own weekly reviews
CREATE POLICY "Users can view their own weekly reviews"
    ON weekly_reviews
    FOR SELECT
    USING (auth.uid() = user_id);

-- Users can INSERT their own weekly reviews
CREATE POLICY "Users can create their own weekly reviews"
    ON weekly_reviews
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can UPDATE their own weekly reviews
CREATE POLICY "Users can update their own weekly reviews"
    ON weekly_reviews
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Users can DELETE their own weekly reviews
CREATE POLICY "Users can delete their own weekly reviews"
    ON weekly_reviews
    FOR DELETE
    USING (auth.uid() = user_id);

-- =============================================================================
-- Body Double Sessions Table Policies
-- =============================================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own body double sessions" ON body_double_sessions;
DROP POLICY IF EXISTS "Users can create their own body double sessions" ON body_double_sessions;
DROP POLICY IF EXISTS "Users can update their own body double sessions" ON body_double_sessions;
DROP POLICY IF EXISTS "Users can delete their own body double sessions" ON body_double_sessions;

-- Users can SELECT their own body double sessions
CREATE POLICY "Users can view their own body double sessions"
    ON body_double_sessions
    FOR SELECT
    USING (auth.uid() = user_id);

-- Users can INSERT their own body double sessions
CREATE POLICY "Users can create their own body double sessions"
    ON body_double_sessions
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can UPDATE their own body double sessions
CREATE POLICY "Users can update their own body double sessions"
    ON body_double_sessions
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Users can DELETE their own body double sessions
CREATE POLICY "Users can delete their own body double sessions"
    ON body_double_sessions
    FOR DELETE
    USING (auth.uid() = user_id);

-- =============================================================================
-- Notes
-- =============================================================================
-- These policies ensure that:
-- 1. Users can only access data where user_id matches their authenticated user ID
-- 2. All CRUD operations (Create, Read, Update, Delete) are restricted to user's own data
-- 3. The auth.uid() function returns the UUID of the currently authenticated user
-- 
-- If you need to modify these policies later, you can:
-- - Drop a policy: DROP POLICY "policy_name" ON table_name;
-- - Alter a policy: Use DROP then CREATE with new definition
-- - View existing policies: SELECT * FROM pg_policies WHERE schemaname = 'public';

