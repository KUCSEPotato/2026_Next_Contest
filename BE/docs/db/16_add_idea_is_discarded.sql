-- Migration: add is_discarded column to ideas table

BEGIN;

ALTER TABLE ideas
    ADD COLUMN IF NOT EXISTS is_discarded BOOLEAN NOT NULL DEFAULT FALSE;

-- Create index for discarded filter queries
CREATE INDEX IF NOT EXISTS idx_ideas_is_discarded ON ideas(is_discarded);

COMMIT;
