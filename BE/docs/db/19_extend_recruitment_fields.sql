-- Migration: Extend ProjectRecruitment with competition fields
-- Description: Add category, difficulty, summary, deadline, created_at, updated_at to project_recruitments

BEGIN;

ALTER TABLE project_recruitments
ADD COLUMN IF NOT EXISTS category VARCHAR(50),
ADD COLUMN IF NOT EXISTS difficulty VARCHAR(20) DEFAULT 'normal',
ADD COLUMN IF NOT EXISTS summary TEXT,
ADD COLUMN IF NOT EXISTS deadline DATE,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_recruitments_deadline ON project_recruitments(deadline);
CREATE INDEX IF NOT EXISTS idx_recruitments_created_at ON project_recruitments(created_at DESC);

COMMIT;
