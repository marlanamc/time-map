-- Migration: Add capacity_checks table
-- Purpose: Store daily capacity check results for users

CREATE TABLE IF NOT EXISTS capacity_checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Date of the check (one per day per user)
    check_date DATE NOT NULL DEFAULT CURRENT_DATE,
    
    -- Capacity assessment results
    capacity_level TEXT NOT NULL CHECK (capacity_level IN ('high', 'medium', 'low', 'rest')),
    energy_type TEXT NOT NULL CHECK (energy_type IN ('focus', 'creative', 'rest', 'admin')),
    available_minutes INTEGER NOT NULL CHECK (available_minutes >= 0),
    
    -- Summary text from the check
    summary TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique constraint: one check per user per day (upsert on re-check)
CREATE UNIQUE INDEX idx_capacity_checks_user_date 
ON capacity_checks(user_id, check_date);

-- Index for querying user's recent checks
CREATE INDEX idx_capacity_checks_user_recent 
ON capacity_checks(user_id, check_date DESC);

-- Enable Row Level Security
ALTER TABLE capacity_checks ENABLE ROW LEVEL SECURITY;

-- RLS Policies: users can only access their own data
CREATE POLICY "Users can view own capacity checks"
ON capacity_checks FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own capacity checks"
ON capacity_checks FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own capacity checks"
ON capacity_checks FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own capacity checks"
ON capacity_checks FOR DELETE
USING (auth.uid() = user_id);

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_capacity_checks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_capacity_checks_updated_at
BEFORE UPDATE ON capacity_checks
FOR EACH ROW
EXECUTE FUNCTION update_capacity_checks_updated_at();

-- Comment for documentation
COMMENT ON TABLE capacity_checks IS 'Daily capacity check results for users, one entry per user per day';
