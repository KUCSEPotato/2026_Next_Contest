ALTER TABLE users
    ADD COLUMN IF NOT EXISTS suspended_until TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS suspension_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_users_suspended_until
    ON users(suspended_until);
