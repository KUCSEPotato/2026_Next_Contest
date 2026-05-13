CREATE TABLE IF NOT EXISTS coin_purchase_requests (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    coin_amount INTEGER NOT NULL,
    price_krw INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    note TEXT,
    admin_note TEXT,
    handled_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    handled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coin_purchase_requests_user_id
    ON coin_purchase_requests(user_id);

CREATE INDEX IF NOT EXISTS idx_coin_purchase_requests_status
    ON coin_purchase_requests(status);
