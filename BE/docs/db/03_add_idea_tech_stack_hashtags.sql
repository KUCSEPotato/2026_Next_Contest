BEGIN;

-- =========================
-- Projects table: add max_members
-- =========================
ALTER TABLE projects ADD COLUMN IF NOT EXISTS max_members SMALLINT;

UPDATE projects
SET max_members = 10
WHERE max_members IS NULL;

ALTER TABLE projects
    ALTER COLUMN max_members SET DEFAULT 10,
    ALTER COLUMN max_members SET NOT NULL;

-- Add constraint if not exists
DO $$
BEGIN
    BEGIN
        ALTER TABLE projects ADD CONSTRAINT projects_max_members_check CHECK (max_members BETWEEN 1 AND 100);
    EXCEPTION WHEN duplicate_object THEN
        NULL;
    END;
END $$;

-- =========================
-- Project Recruitments table: add deadline, difficulty, category, summary
-- =========================
ALTER TABLE project_recruitments ADD COLUMN IF NOT EXISTS deadline DATE;
ALTER TABLE project_recruitments ADD COLUMN IF NOT EXISTS difficulty difficulty_level;
ALTER TABLE project_recruitments ADD COLUMN IF NOT EXISTS category VARCHAR(50);
ALTER TABLE project_recruitments ADD COLUMN IF NOT EXISTS summary TEXT;

-- All new columns are nullable

-- =========================
-- Ideas table: add tech_stack, hashtags
-- =========================
ALTER TABLE ideas ADD COLUMN IF NOT EXISTS tech_stack JSON;
ALTER TABLE ideas ADD COLUMN IF NOT EXISTS hashtags JSON;

UPDATE ideas
SET tech_stack = '[]'::json
WHERE tech_stack IS NULL;

UPDATE ideas
SET hashtags = '[]'::json
WHERE hashtags IS NULL;

ALTER TABLE ideas
    ALTER COLUMN tech_stack SET DEFAULT '[]'::json,
    ALTER COLUMN hashtags SET DEFAULT '[]'::json;

ALTER TABLE ideas
    ALTER COLUMN tech_stack SET NOT NULL,
    ALTER COLUMN hashtags SET NOT NULL;

COMMIT;
