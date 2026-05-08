-- Migration: Add file upload support
-- Description: Create tables for community posts and ideas file attachments

BEGIN;

-- ======================================
-- 1) Community Post Files Table
-- ======================================
CREATE TABLE IF NOT EXISTS community_post_files (
    id BIGSERIAL PRIMARY KEY,
    post_id BIGINT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    file_size BIGINT NOT NULL,
    file_type VARCHAR(50) NOT NULL,
    s3_key VARCHAR(500) NOT NULL,
    s3_url TEXT NOT NULL,
    uploaded_by BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_post_files_post_id ON community_post_files(post_id);
CREATE INDEX IF NOT EXISTS idx_post_files_uploaded_by ON community_post_files(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_post_files_created_at ON community_post_files(created_at DESC);

-- ======================================
-- 2) Idea Files Table
-- ======================================
CREATE TABLE IF NOT EXISTS idea_files (
    id BIGSERIAL PRIMARY KEY,
    idea_id BIGINT NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    file_size BIGINT NOT NULL,
    file_type VARCHAR(50) NOT NULL,
    s3_key VARCHAR(500) NOT NULL,
    s3_url TEXT NOT NULL,
    uploaded_by BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_idea_files_idea_id ON idea_files(idea_id);
CREATE INDEX IF NOT EXISTS idx_idea_files_uploaded_by ON idea_files(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_idea_files_created_at ON idea_files(created_at DESC);

COMMIT;
