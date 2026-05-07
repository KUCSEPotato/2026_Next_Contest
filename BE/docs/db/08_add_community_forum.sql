-- Migration: Add Community Forum Tables
-- Purpose: Enable community posts, comments, and reactions
-- Date: 2026-05-06

BEGIN;

-- ======================================
-- 1) Enum Types for Community
-- ======================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'reaction_type') THEN
        CREATE TYPE reaction_type AS ENUM ('like', 'interested', 'helpful', 'curious');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'post_category') THEN
        CREATE TYPE post_category AS ENUM ('general', 'question', 'idea', 'showcase', 'event', 'announcement');
    END IF;
END $$;

-- ======================================
-- 2) Community Posts Table
-- ======================================
CREATE TABLE IF NOT EXISTS community_posts (
    id BIGSERIAL PRIMARY KEY,
    author_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(300) NOT NULL,
    content TEXT NOT NULL,
    category post_category NOT NULL DEFAULT 'general',
    is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
    view_count BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT community_posts_title_check CHECK (LENGTH(title) > 0),
    CONSTRAINT community_posts_content_check CHECK (LENGTH(content) > 0)
);

CREATE INDEX IF NOT EXISTS idx_community_posts_author_id ON community_posts(author_id);
CREATE INDEX IF NOT EXISTS idx_community_posts_category ON community_posts(category);
CREATE INDEX IF NOT EXISTS idx_community_posts_created_at ON community_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_posts_is_pinned ON community_posts(is_pinned DESC);

-- ======================================
-- 3) Community Comments Table
-- ======================================
CREATE TABLE IF NOT EXISTS community_post_comments (
    id BIGSERIAL PRIMARY KEY,
    post_id BIGINT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
    author_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    parent_comment_id BIGINT REFERENCES community_post_comments(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT post_comments_content_check CHECK (LENGTH(content) > 0)
);

CREATE INDEX IF NOT EXISTS idx_post_comments_post_id ON community_post_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_post_comments_author_id ON community_post_comments(author_id);
CREATE INDEX IF NOT EXISTS idx_post_comments_parent_comment_id ON community_post_comments(parent_comment_id);
CREATE INDEX IF NOT EXISTS idx_post_comments_created_at ON community_post_comments(created_at DESC);

-- ======================================
-- 4) Post Reactions Table
-- ======================================
CREATE TABLE IF NOT EXISTS community_post_reactions (
    id BIGSERIAL PRIMARY KEY,
    post_id BIGINT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reaction_type reaction_type NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT community_post_reactions_unique UNIQUE (post_id, user_id, reaction_type)
);

CREATE INDEX IF NOT EXISTS idx_post_reactions_post_id ON community_post_reactions(post_id);
CREATE INDEX IF NOT EXISTS idx_post_reactions_user_id ON community_post_reactions(user_id);
CREATE INDEX IF NOT EXISTS idx_post_reactions_type ON community_post_reactions(reaction_type);

-- ======================================
-- 5) Comment Reactions Table
-- ======================================
CREATE TABLE IF NOT EXISTS community_comment_reactions (
    id BIGSERIAL PRIMARY KEY,
    comment_id BIGINT NOT NULL REFERENCES community_post_comments(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reaction_type reaction_type NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT community_comment_reactions_unique UNIQUE (comment_id, user_id, reaction_type)
);

CREATE INDEX IF NOT EXISTS idx_comment_reactions_comment_id ON community_comment_reactions(comment_id);
CREATE INDEX IF NOT EXISTS idx_comment_reactions_user_id ON community_comment_reactions(user_id);

-- ======================================
-- 6) Triggers for Timestamps
-- ======================================
CREATE TRIGGER IF NOT EXISTS set_community_posts_updated_at
    BEFORE UPDATE ON community_posts
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER IF NOT EXISTS set_post_comments_updated_at
    BEFORE UPDATE ON community_post_comments
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

COMMIT;
