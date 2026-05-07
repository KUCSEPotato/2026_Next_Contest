-- Migration: add min_members column to projects

BEGIN;

ALTER TABLE projects
    ADD COLUMN IF NOT EXISTS min_members SMALLINT NOT NULL DEFAULT 1;

-- Backfill existing rows (optional, covered by DEFAULT above)
UPDATE projects SET min_members = 1 WHERE min_members IS NULL;

COMMIT;
