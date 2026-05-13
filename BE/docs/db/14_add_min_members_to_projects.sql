-- Migration: Add min_members column to projects table
-- Purpose: Sync database schema with Project ORM model
-- Date: 2026-05-07

BEGIN;

-- Add min_members column if it doesn't exist
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS min_members SMALLINT;

UPDATE projects
SET min_members = 1
WHERE min_members IS NULL;

ALTER TABLE projects
	ALTER COLUMN min_members SET DEFAULT 1,
	ALTER COLUMN min_members SET NOT NULL;

-- Add constraint to validate min_members
DO $$
BEGIN
	BEGIN
		ALTER TABLE projects ADD CONSTRAINT projects_min_members_check CHECK (min_members BETWEEN 1 AND 100);
	EXCEPTION WHEN duplicate_object THEN
		NULL;
	END;
END $$;

COMMIT;