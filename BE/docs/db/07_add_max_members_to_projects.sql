-- Migration: Add max_members column to projects table
-- Purpose: Sync database schema with Project ORM model
-- Date: 2026-05-06

BEGIN;

-- Add max_members column if it doesn't exist
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS max_members SMALLINT;

UPDATE projects
SET max_members = 10
WHERE max_members IS NULL;

ALTER TABLE projects
	ALTER COLUMN max_members SET DEFAULT 10,
	ALTER COLUMN max_members SET NOT NULL;

-- Add constraint to validate max_members
DO $$
BEGIN
	BEGIN
		ALTER TABLE projects ADD CONSTRAINT projects_max_members_check CHECK (max_members BETWEEN 1 AND 100);
	EXCEPTION WHEN duplicate_object THEN
		NULL;
	END;
END $$;

COMMIT;
