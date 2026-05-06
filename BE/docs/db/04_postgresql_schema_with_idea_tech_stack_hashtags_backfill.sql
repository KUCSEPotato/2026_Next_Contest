-- Devory PostgreSQL Schema (v1)
-- Target: PostgreSQL 14+

BEGIN;

-- =========================
-- 1) Extensions
-- =========================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =========================
-- 2) Enum Types
-- =========================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'difficulty_level') THEN
        CREATE TYPE difficulty_level AS ENUM ('beginner', 'intermediate', 'advanced');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'project_status') THEN
        CREATE TYPE project_status AS ENUM ('planning', 'in_progress', 'paused', 'completed', 'archived');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'application_status') THEN
        CREATE TYPE application_status AS ENUM ('pending', 'accepted', 'rejected', 'withdrawn');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invite_status') THEN
        CREATE TYPE invite_status AS ENUM ('pending', 'accepted', 'rejected', 'expired');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'todo_status') THEN
        CREATE TYPE todo_status AS ENUM ('todo', 'in_progress', 'blocked', 'done');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'recruitment_status') THEN
        CREATE TYPE recruitment_status AS ENUM ('open', 'closed', 'cancelled');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'adoption_status') THEN
        CREATE TYPE adoption_status AS ENUM ('pending', 'approved', 'rejected', 'cancelled');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscription_status') THEN
        CREATE TYPE subscription_status AS ENUM ('active', 'trialing', 'past_due', 'cancelled', 'expired');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'billing_cycle') THEN
        CREATE TYPE billing_cycle AS ENUM ('monthly', 'yearly');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_type') THEN
        CREATE TYPE notification_type AS ENUM (
            'application_received',
            'application_decided',
            'invite_received',
            'invite_decided',
            'project_update',
            'review_received',
            'subscription_event',
            'system'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_status') THEN
        CREATE TYPE report_status AS ENUM ('open', 'in_review', 'resolved', 'dismissed');
    END IF;
END $$;

-- =========================
-- 3) Common timestamp helper
-- =========================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =========================
-- 4) Core Identity
-- =========================
CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash TEXT,
    github_id VARCHAR(100) UNIQUE,
    google_id VARCHAR(100) UNIQUE,
    nickname VARCHAR(50) NOT NULL UNIQUE,
    bio TEXT,
    avatar_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    role VARCHAR(20) NOT NULL DEFAULT 'user',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT users_role_check CHECK (role IN ('user', 'leader', 'admin'))
);

CREATE TABLE IF NOT EXISTS skills (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    normalized_name VARCHAR(50) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_skills (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    skill_id BIGINT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
    proficiency SMALLINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT user_skills_unique UNIQUE (user_id, skill_id),
    CONSTRAINT user_skills_proficiency_check CHECK (proficiency IS NULL OR (proficiency BETWEEN 1 AND 5))
);

CREATE TABLE IF NOT EXISTS interests (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    normalized_name VARCHAR(50) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_interests (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    interest_id BIGINT NOT NULL REFERENCES interests(id) ON DELETE CASCADE,
    interest_level SMALLINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT user_interests_unique UNIQUE (user_id, interest_id),
    CONSTRAINT user_interests_level_check CHECK (interest_level IS NULL OR interest_level BETWEEN 1 AND 5)
);

CREATE TABLE IF NOT EXISTS project_skills (
    id BIGSERIAL PRIMARY KEY,
    project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    skill_id BIGINT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
    required_level SMALLINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT project_skills_unique UNIQUE (project_id, skill_id),
    CONSTRAINT project_skills_level_check CHECK (required_level IS NULL OR required_level BETWEEN 1 AND 5)
);

CREATE TABLE IF NOT EXISTS project_interests (
    id BIGSERIAL PRIMARY KEY,
    project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    interest_id BIGINT NOT NULL REFERENCES interests(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT project_interests_unique UNIQUE (project_id, interest_id)
);

-- =========================
-- 5) Idea Domain
-- =========================
CREATE TABLE IF NOT EXISTS ideas (
    id BIGSERIAL PRIMARY KEY,
    author_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    title VARCHAR(200) NOT NULL,
    summary TEXT,
    description TEXT NOT NULL,
    domain VARCHAR(50),
    tech_stack JSON NOT NULL DEFAULT '[]'::json,
    hashtags JSON NOT NULL DEFAULT '[]'::json,
    difficulty difficulty_level NOT NULL,
    required_members SMALLINT NOT NULL DEFAULT 1,
    is_open BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT ideas_required_members_check CHECK (required_members BETWEEN 1 AND 100)
);

CREATE TABLE IF NOT EXISTS idea_bookmarks (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    idea_id BIGINT NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT idea_bookmarks_unique UNIQUE (user_id, idea_id)
);

CREATE TABLE IF NOT EXISTS idea_likes (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    idea_id BIGINT NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT idea_likes_unique UNIQUE (user_id, idea_id)
);

-- =========================
-- 6) Project Domain
-- =========================
CREATE TABLE IF NOT EXISTS projects (
    id BIGSERIAL PRIMARY KEY,
    idea_id BIGINT REFERENCES ideas(id) ON DELETE SET NULL,
    leader_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    title VARCHAR(200) NOT NULL,
    summary TEXT,
    description TEXT NOT NULL,
    category VARCHAR(50),
    difficulty difficulty_level NOT NULL,
    status project_status NOT NULL DEFAULT 'planning',
    progress_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
    max_members SMALLINT NOT NULL DEFAULT 10,
    is_public BOOLEAN NOT NULL DEFAULT TRUE,
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT projects_progress_check CHECK (progress_percent >= 0 AND progress_percent <= 100),
    CONSTRAINT projects_max_members_check CHECK (max_members BETWEEN 1 AND 100)
);

CREATE TABLE IF NOT EXISTS project_members (
    id BIGSERIAL PRIMARY KEY,
    project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_in_project VARCHAR(50) NOT NULL,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    left_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT project_members_unique UNIQUE (project_id, user_id)
);

CREATE TABLE IF NOT EXISTS project_milestones (
    id BIGSERIAL PRIMARY KEY,
    project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title VARCHAR(150) NOT NULL,
    description TEXT,
    due_date DATE,
    is_done BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS project_recruitments (
    id BIGSERIAL PRIMARY KEY,
    project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    position_name VARCHAR(100) NOT NULL,
    required_count SMALLINT NOT NULL DEFAULT 1,
    status recruitment_status NOT NULL DEFAULT 'open',
    difficulty difficulty_level,
    category VARCHAR(50),
    summary TEXT,
    deadline DATE,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT project_recruitments_required_count_check CHECK (required_count BETWEEN 1 AND 20)
);

CREATE TABLE IF NOT EXISTS applications (
    id BIGSERIAL PRIMARY KEY,
    project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    applicant_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message TEXT,
    status application_status NOT NULL DEFAULT 'pending',
    decided_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    decided_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT applications_unique UNIQUE (project_id, applicant_id)
);

CREATE TABLE IF NOT EXISTS invitations (
    id BIGSERIAL PRIMARY KEY,
    project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    inviter_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    invitee_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message TEXT,
    status invite_status NOT NULL DEFAULT 'pending',
    expires_at TIMESTAMPTZ,
    decided_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT invitations_unique_pending UNIQUE (project_id, invitee_id, status)
);

CREATE TABLE IF NOT EXISTS todos (
    id BIGSERIAL PRIMARY KEY,
    project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    assignee_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    creator_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    stage VARCHAR(30) NOT NULL DEFAULT 'planning',
    status todo_status NOT NULL DEFAULT 'todo',
    priority SMALLINT NOT NULL DEFAULT 3,
    due_date DATE,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT todos_priority_check CHECK (priority BETWEEN 1 AND 5)
);

CREATE TABLE IF NOT EXISTS todo_assignments (
    id BIGSERIAL PRIMARY KEY,
    todo_id BIGINT NOT NULL REFERENCES todos(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_done BOOLEAN NOT NULL DEFAULT FALSE,
    done_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT todo_assignments_unique UNIQUE (todo_id, user_id)
);

CREATE TABLE IF NOT EXISTS todo_templates (
    id BIGSERIAL PRIMARY KEY,
    template_key VARCHAR(100) NOT NULL UNIQUE,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    stage VARCHAR(30) NOT NULL DEFAULT 'planning',
    priority SMALLINT NOT NULL DEFAULT 3,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS retrospectives (
    id BIGSERIAL PRIMARY KEY,
    project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    author_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    title VARCHAR(200) NOT NULL,
    what_went_well TEXT,
    what_went_badly TEXT,
    lessons_learned TEXT,
    next_actions TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS failure_stories (
    id BIGSERIAL PRIMARY KEY,
    project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    author_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    title VARCHAR(200) NOT NULL,
    problem_summary TEXT NOT NULL,
    root_cause TEXT,
    attempted_solutions TEXT,
    lessons_learned TEXT,
    is_public BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS adoption_requests (
    id BIGSERIAL PRIMARY KEY,
    project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    requester_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message TEXT,
    status adoption_status NOT NULL DEFAULT 'pending',
    decided_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    decided_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT adoption_requests_unique_pending UNIQUE (project_id, requester_id, status)
);

CREATE TABLE IF NOT EXISTS reviews (
    id BIGSERIAL PRIMARY KEY,
    project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    reviewer_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reviewee_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    teamwork_score SMALLINT NOT NULL,
    contribution_score SMALLINT NOT NULL,
    responsibility_score SMALLINT NOT NULL,
    comment TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT reviews_unique UNIQUE (project_id, reviewer_id, reviewee_id),
    CONSTRAINT reviews_no_self_check CHECK (reviewer_id <> reviewee_id),
    CONSTRAINT reviews_teamwork_check CHECK (teamwork_score BETWEEN 1 AND 5),
    CONSTRAINT reviews_contribution_check CHECK (contribution_score BETWEEN 1 AND 5),
    CONSTRAINT reviews_responsibility_check CHECK (responsibility_score BETWEEN 1 AND 5)
);

CREATE TABLE IF NOT EXISTS user_rating_aggregates (
    user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    review_count INTEGER NOT NULL DEFAULT 0,
    avg_teamwork NUMERIC(4,2) NOT NULL DEFAULT 0,
    avg_contribution NUMERIC(4,2) NOT NULL DEFAULT 0,
    avg_responsibility NUMERIC(4,2) NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================
-- 7) Subscription / Billing
-- =========================
CREATE TABLE IF NOT EXISTS subscription_plans (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    price_krw INTEGER NOT NULL,
    cycle billing_cycle NOT NULL,
    features JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT subscription_plans_price_check CHECK (price_krw >= 0)
);

CREATE TABLE IF NOT EXISTS user_subscriptions (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_id BIGINT NOT NULL REFERENCES subscription_plans(id) ON DELETE RESTRICT,
    status subscription_status NOT NULL,
    current_period_start TIMESTAMPTZ NOT NULL,
    current_period_end TIMESTAMPTZ NOT NULL,
    cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
    external_subscription_id VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payment_events (
    id BIGSERIAL PRIMARY KEY,
    user_subscription_id BIGINT REFERENCES user_subscriptions(id) ON DELETE SET NULL,
    provider VARCHAR(50) NOT NULL,
    provider_event_id VARCHAR(150) NOT NULL UNIQUE,
    event_type VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================
-- 8) Chat / Notification / Admin
-- =========================
CREATE TABLE IF NOT EXISTS chat_rooms (
    id BIGSERIAL PRIMARY KEY,
    project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(100),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_messages (
    id BIGSERIAL PRIMARY KEY,
    room_id BIGINT NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
    sender_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type notification_type NOT NULL,
    title VARCHAR(150) NOT NULL,
    body TEXT,
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    read_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS reports (
    id BIGSERIAL PRIMARY KEY,
    reporter_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    target_project_id BIGINT REFERENCES projects(id) ON DELETE SET NULL,
    reason TEXT NOT NULL,
    status report_status NOT NULL DEFAULT 'open',
    handled_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    handled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================
-- 9) Indexes
-- =========================
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_github_id ON users(github_id);
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ideas_author_id ON ideas(author_id);
CREATE INDEX IF NOT EXISTS idx_ideas_difficulty ON ideas(difficulty);
CREATE INDEX IF NOT EXISTS idx_ideas_open_created ON ideas(is_open, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_projects_leader_id ON projects(leader_id);
CREATE INDEX IF NOT EXISTS idx_projects_status_created ON projects(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_projects_difficulty ON projects(difficulty);

CREATE INDEX IF NOT EXISTS idx_project_members_project_id ON project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user_id ON project_members(user_id);

CREATE INDEX IF NOT EXISTS idx_applications_project_status ON applications(project_id, status);
CREATE INDEX IF NOT EXISTS idx_applications_applicant_id ON applications(applicant_id);

CREATE INDEX IF NOT EXISTS idx_todos_project_status ON todos(project_id, status);
CREATE INDEX IF NOT EXISTS idx_todos_assignee_id ON todos(assignee_id);

CREATE INDEX IF NOT EXISTS idx_reviews_reviewee_id ON reviews(reviewee_id);
CREATE INDEX IF NOT EXISTS idx_reviews_project_id ON reviews(project_id);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_room_created ON chat_messages(room_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_reports_status_created ON reports(status, created_at DESC);

-- Full-text search starter indexes
CREATE INDEX IF NOT EXISTS idx_ideas_title_gin ON ideas USING GIN (to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(description, '')));
CREATE INDEX IF NOT EXISTS idx_projects_title_gin ON projects USING GIN (to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(description, '')));

-- =========================
-- 10) Triggers
-- =========================
DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_ideas_updated_at ON ideas;
CREATE TRIGGER trg_ideas_updated_at
BEFORE UPDATE ON ideas
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_projects_updated_at ON projects;
CREATE TRIGGER trg_projects_updated_at
BEFORE UPDATE ON projects
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_milestones_updated_at ON project_milestones;
CREATE TRIGGER trg_milestones_updated_at
BEFORE UPDATE ON project_milestones
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_recruitments_updated_at ON project_recruitments;
CREATE TRIGGER trg_recruitments_updated_at
BEFORE UPDATE ON project_recruitments
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_applications_updated_at ON applications;
CREATE TRIGGER trg_applications_updated_at
BEFORE UPDATE ON applications
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_invitations_updated_at ON invitations;
CREATE TRIGGER trg_invitations_updated_at
BEFORE UPDATE ON invitations
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_todos_updated_at ON todos;
CREATE TRIGGER trg_todos_updated_at
BEFORE UPDATE ON todos
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_retrospectives_updated_at ON retrospectives;
CREATE TRIGGER trg_retrospectives_updated_at
BEFORE UPDATE ON retrospectives
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_failure_stories_updated_at ON failure_stories;
CREATE TRIGGER trg_failure_stories_updated_at
BEFORE UPDATE ON failure_stories
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_adoption_requests_updated_at ON adoption_requests;
CREATE TRIGGER trg_adoption_requests_updated_at
BEFORE UPDATE ON adoption_requests
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_user_subscriptions_updated_at ON user_subscriptions;
CREATE TRIGGER trg_user_subscriptions_updated_at
BEFORE UPDATE ON user_subscriptions
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_reports_updated_at ON reports;
CREATE TRIGGER trg_reports_updated_at
BEFORE UPDATE ON reports
FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- =========================
-- 11) Ideas tech_stack/hashtags backfill (from 03)
-- =========================

ALTER TABLE ideas ADD COLUMN IF NOT EXISTS tech_stack JSON;
ALTER TABLE ideas ADD COLUMN IF NOT EXISTS hashtags JSON;

UPDATE ideas
SET tech_stack = '[]'::json
WHERE tech_stack IS NULL;

UPDATE ideas
SET hashtags = '[]'::json
WHERE hashtags IS NULL;

ALTER TABLE ideas
    ALTER COLUMN tech_stack SET DEFAULT '[]'::json,
    ALTER COLUMN hashtags SET DEFAULT '[]'::json;

ALTER TABLE ideas
    ALTER COLUMN tech_stack SET NOT NULL,
    ALTER COLUMN hashtags SET NOT NULL;


COMMIT;
