-- Migration: Backfill users.avatar_s3_key from legacy raw S3 avatar_url
-- Purpose:
--   - Move legacy private S3 object URLs into users.avatar_s3_key.
--   - Stop storing raw private S3 object URLs in users.avatar_url.
--   - Preserve non-S3 external avatar_url values, such as OAuth provider images.
-- Date: 2026-05-12

BEGIN;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS avatar_s3_key VARCHAR(500);

UPDATE users
SET avatar_s3_key = regexp_replace(
    avatar_url,
    '^https?://[^/]+/(.+?)(\?.*)?$',
    '\1'
)
WHERE avatar_s3_key IS NULL
  AND avatar_url ~ '^https?://[^/]*amazonaws\.com/';

UPDATE users
SET avatar_url = NULL
WHERE avatar_s3_key IS NOT NULL
  AND avatar_url ~ '^https?://[^/]*amazonaws\.com/';

COMMIT;
