-- Add memoir fields and timestamp backfill to retrospectives table.
-- This script is safe to run repeatedly on existing environments.

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

ALTER TABLE retrospectives
ADD COLUMN IF NOT EXISTS tech_stack JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS domain VARCHAR(100),
ADD COLUMN IF NOT EXISTS felt_point TEXT,
ADD COLUMN IF NOT EXISTS lacked_point TEXT,
ADD COLUMN IF NOT EXISTS ai_refined_felt TEXT,
ADD COLUMN IF NOT EXISTS ai_refined_lacked TEXT,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

UPDATE retrospectives
SET
    created_at = COALESCE(created_at, NOW()),
    updated_at = COALESCE(updated_at, NOW())
WHERE created_at IS NULL
   OR updated_at IS NULL;

ALTER TABLE retrospectives
ALTER COLUMN created_at SET DEFAULT NOW(),
ALTER COLUMN updated_at SET DEFAULT NOW(),
ALTER COLUMN created_at SET NOT NULL,
ALTER COLUMN updated_at SET NOT NULL;

DROP TRIGGER IF EXISTS trg_retrospectives_updated_at ON retrospectives;
CREATE TRIGGER trg_retrospectives_updated_at
BEFORE UPDATE ON retrospectives
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Alter projects table to track project execution time
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
