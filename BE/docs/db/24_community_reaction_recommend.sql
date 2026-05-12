-- Migration: Convert community reaction types to recommend / not_recommend
-- Purpose:
--   - Replace legacy community reaction values
--     (like, interested, helpful, curious) with recommend / not_recommend.
--   - Map existing legacy positive reactions to recommend.
--   - Deduplicate old multi-reaction rows so each user has only one reaction
--     per post/comment.
-- Date: 2026-05-12

BEGIN;

-- Convert enum-backed columns to text first so legacy enum labels can be
-- normalized before recreating the enum with the new labels.
ALTER TABLE IF EXISTS community_post_reactions
    DROP CONSTRAINT IF EXISTS community_post_reactions_unique;

ALTER TABLE IF EXISTS community_comment_reactions
    DROP CONSTRAINT IF EXISTS community_comment_reactions_unique;

ALTER TABLE IF EXISTS community_post_reactions
    ALTER COLUMN reaction_type TYPE TEXT USING reaction_type::TEXT;

ALTER TABLE IF EXISTS community_comment_reactions
    ALTER COLUMN reaction_type TYPE TEXT USING reaction_type::TEXT;

-- Legacy reaction types were all positive signals, so keep that meaning as
-- recommend. Existing not_recommend rows are preserved for idempotency.
UPDATE community_post_reactions
SET reaction_type = CASE
    WHEN reaction_type = 'not_recommend' THEN 'not_recommend'
    ELSE 'recommend'
END
WHERE reaction_type IS DISTINCT FROM CASE
    WHEN reaction_type = 'not_recommend' THEN 'not_recommend'
    ELSE 'recommend'
END;

UPDATE community_comment_reactions
SET reaction_type = CASE
    WHEN reaction_type = 'not_recommend' THEN 'not_recommend'
    ELSE 'recommend'
END
WHERE reaction_type IS DISTINCT FROM CASE
    WHEN reaction_type = 'not_recommend' THEN 'not_recommend'
    ELSE 'recommend'
END;

-- Old schema allowed one row per reaction type, which means a user could have
-- multiple legacy rows on the same post/comment. Keep the newest row.
WITH ranked AS (
    SELECT
        id,
        ROW_NUMBER() OVER (
            PARTITION BY post_id, user_id
            ORDER BY created_at DESC NULLS LAST, id DESC
        ) AS rn
    FROM community_post_reactions
)
DELETE FROM community_post_reactions r
USING ranked
WHERE r.id = ranked.id
  AND ranked.rn > 1;

WITH ranked AS (
    SELECT
        id,
        ROW_NUMBER() OVER (
            PARTITION BY comment_id, user_id
            ORDER BY created_at DESC NULLS LAST, id DESC
        ) AS rn
    FROM community_comment_reactions
)
DELETE FROM community_comment_reactions r
USING ranked
WHERE r.id = ranked.id
  AND ranked.rn > 1;

DROP TYPE IF EXISTS reaction_type;
CREATE TYPE reaction_type AS ENUM ('recommend', 'not_recommend');

ALTER TABLE IF EXISTS community_post_reactions
    ALTER COLUMN reaction_type TYPE reaction_type USING reaction_type::reaction_type;

ALTER TABLE IF EXISTS community_comment_reactions
    ALTER COLUMN reaction_type TYPE reaction_type USING reaction_type::reaction_type;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'community_post_reactions'
    ) AND NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'community_post_reactions_unique'
    ) THEN
        ALTER TABLE community_post_reactions
            ADD CONSTRAINT community_post_reactions_unique UNIQUE (post_id, user_id);
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'community_comment_reactions'
    ) AND NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'community_comment_reactions_unique'
    ) THEN
        ALTER TABLE community_comment_reactions
            ADD CONSTRAINT community_comment_reactions_unique UNIQUE (comment_id, user_id);
    END IF;
END $$;

COMMIT;
