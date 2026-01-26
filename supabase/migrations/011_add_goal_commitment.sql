-- Add commitment column to goals table for recurring intentions
ALTER TABLE goals
ADD COLUMN IF NOT EXISTS commitment JSONB;

-- Comment for documentation
COMMENT ON COLUMN goals.commitment IS 'Recurring intention settings (frequency, duration, energy)';
