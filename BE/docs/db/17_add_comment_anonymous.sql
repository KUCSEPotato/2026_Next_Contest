-- Migration: Add anonymous comment support
-- Description: Add is_anonymous field to community_post_comments table

BEGIN;

ALTER TABLE community_post_comments
ADD COLUMN IF NOT EXISTS is_anonymous BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_post_comments_is_anonymous 
ON community_post_comments(is_anonymous);

COMMIT;
