-- Toss Payments payment orders and approval records.

CREATE TABLE IF NOT EXISTS payments (
    id BIGSERIAL PRIMARY KEY,

    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    order_id VARCHAR(100) NOT NULL UNIQUE,
    payment_key VARCHAR(200) UNIQUE,

    order_name VARCHAR(255) NOT NULL,
    amount INTEGER NOT NULL CHECK (amount > 0),
    coin_amount INTEGER CHECK (coin_amount IS NULL OR coin_amount > 0),

    currency VARCHAR(10) NOT NULL DEFAULT 'KRW',
    status VARCHAR(30) NOT NULL DEFAULT 'READY',
    method VARCHAR(50),
    provider VARCHAR(30) NOT NULL DEFAULT 'TOSS',

    toss_raw_response JSONB,

    requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    approved_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    canceled_at TIMESTAMPTZ,

    failure_code VARCHAR(100),
    failure_message TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_payment_key ON payments(payment_key);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
