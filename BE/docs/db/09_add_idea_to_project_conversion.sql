-- Migration: Add converted_to_project_id to ideas table
-- Purpose: Track Idea→Project conversion for two-path workflow
-- 1. Idea 등록 후 인원이 모이면 프로젝트로 전환
-- 2. 처음부터 프로젝트 생성하여 기획부터 진행까지

ALTER TABLE ideas
ADD COLUMN IF NOT EXISTS converted_to_project_id BIGINT REFERENCES projects(id) ON DELETE SET NULL;

-- Create index for conversion lookup
CREATE INDEX IF NOT EXISTS idx_ideas_converted_to_project_id ON ideas(converted_to_project_id);

-- Comment for documentation
COMMENT ON COLUMN ideas.converted_to_project_id IS 'Tracks which project this idea was converted to (if any). NULL means idea was not converted.';
