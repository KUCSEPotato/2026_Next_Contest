-- Add tech_stack, domain, and ai_refined_text fields to retrospectives table
-- Rename what_went_well and what_went_badly for clarity
-- Add started_at, completed_at tracking to projects if not exists

ALTER TABLE retrospectives
ADD COLUMN IF NOT EXISTS tech_stack JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS domain VARCHAR(100),
ADD COLUMN IF NOT EXISTS felt_point TEXT,
ADD COLUMN IF NOT EXISTS lacked_point TEXT,
ADD COLUMN IF NOT EXISTS ai_refined_felt TEXT,
ADD COLUMN IF NOT EXISTS ai_refined_lacked TEXT;

-- Alter projects table to track project execution time
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
