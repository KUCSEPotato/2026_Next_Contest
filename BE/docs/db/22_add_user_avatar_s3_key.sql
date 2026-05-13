-- Store private S3 avatar object keys separately from public/external avatar URLs.
-- Safe to run repeatedly.

ALTER TABLE users
ADD COLUMN IF NOT EXISTS avatar_s3_key VARCHAR(500);
