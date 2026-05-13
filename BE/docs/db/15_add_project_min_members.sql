-- Migration: add min_members column to projects

BEGIN;

ALTER TABLE projects
    ADD COLUMN IF NOT EXISTS min_members SMALLINT;

-- Backfill existing rows (optional, covered by DEFAULT above)
UPDATE projects SET min_members = 1 WHERE min_members IS NULL;

ALTER TABLE projects
    ALTER COLUMN min_members SET DEFAULT 1,
    ALTER COLUMN min_members SET NOT NULL;

DO $$
BEGIN
    BEGIN
        ALTER TABLE projects ADD CONSTRAINT projects_min_members_check CHECK (min_members BETWEEN 1 AND 100);
    EXCEPTION WHEN duplicate_object THEN
        NULL;
    END;
END $$;

COMMIT;
