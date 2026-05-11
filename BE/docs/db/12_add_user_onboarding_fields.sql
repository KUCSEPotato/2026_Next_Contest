-- Emergency/feature migration: add user onboarding fields for 3-step signup

-- This migration ensures the `name`, `phone_number`, `onboarding_step` and
-- `onboarding_completed_at` columns exist, backfills `name` from `nickname`,
-- and sets a safe default for `onboarding_step` used by the application.

BEGIN;

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS name VARCHAR(100),
    ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20),
    ADD COLUMN IF NOT EXISTS onboarding_step VARCHAR(20) NOT NULL DEFAULT 'completed',
    ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

-- Backfill existing rows: prefer existing name, otherwise use nickname.
UPDATE users
SET
    name = COALESCE(name, nickname),
    onboarding_step = COALESCE(onboarding_step, 'completed'),
    onboarding_completed_at = COALESCE(onboarding_completed_at, created_at)
WHERE deleted_at IS NULL;

-- Create index for quick onboarding queries
CREATE INDEX IF NOT EXISTS idx_users_onboarding_step ON users(onboarding_step);

COMMIT;