BEGIN;

-- =========================
-- Todos table: add stage for workflow grouping
-- =========================
ALTER TABLE todos ADD COLUMN IF NOT EXISTS stage VARCHAR(30);

UPDATE todos
SET stage = 'planning'
WHERE stage IS NULL;

ALTER TABLE todos
    ALTER COLUMN stage SET DEFAULT 'planning',
    ALTER COLUMN stage SET NOT NULL;

-- =========================
-- New table: todo_assignments
-- =========================
CREATE TABLE IF NOT EXISTS todo_assignments (
    id BIGSERIAL PRIMARY KEY,
    todo_id BIGINT NOT NULL REFERENCES todos(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_done BOOLEAN NOT NULL DEFAULT FALSE,
    done_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT todo_assignments_unique UNIQUE (todo_id, user_id)
);

-- =========================
-- New table: todo_templates
-- =========================
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

COMMIT;