-- Migration: Add min_members column to projects table
-- Purpose: Sync database schema with Project ORM model
-- Date: 2026-05-07

BEGIN;

-- Add min_members column if it doesn't exist
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS min_members SMALLINT NOT NULL DEFAULT 1;

-- Add constraint to validate min_members
ALTER TABLE projects
ADD CONSTRAINT projects_min_members_check CHECK (min_members BETWEEN 1 AND 100);

COMMIT;