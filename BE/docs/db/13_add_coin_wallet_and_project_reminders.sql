-- Feature migration: add coin wallet and project reminder support

BEGIN;

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS coin_balance INTEGER NOT NULL DEFAULT 0;

UPDATE users
SET coin_balance = COALESCE(coin_balance, 0)
WHERE coin_balance IS NULL;

CREATE TABLE IF NOT EXISTS coin_transactions (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    source_type VARCHAR(50),
    source_id BIGINT,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT coin_transactions_amount_check CHECK (amount > 0)
);

CREATE INDEX IF NOT EXISTS idx_coin_transactions_user_id ON coin_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_coin_transactions_event_type ON coin_transactions(event_type);
CREATE INDEX IF NOT EXISTS idx_coin_transactions_source ON coin_transactions(source_type, source_id);

COMMIT;