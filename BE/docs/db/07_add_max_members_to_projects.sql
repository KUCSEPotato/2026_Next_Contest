-- Migration: Add max_members column to projects table
-- Purpose: Sync database schema with Project ORM model
-- Date: 2026-05-06

BEGIN;

-- Add max_members column if it doesn't exist
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS max_members SMALLINT NOT NULL DEFAULT 10;

-- Add constraint to validate max_members
ALTER TABLE projects
ADD CONSTRAINT projects_max_members_check CHECK (max_members BETWEEN 1 AND 100);

COMMIT;
