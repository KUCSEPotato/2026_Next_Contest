-- Payment products, user entitlements, and usage logs for Devory monetization.

CREATE TABLE IF NOT EXISTS payment_products (
    id BIGSERIAL PRIMARY KEY,
    product_code VARCHAR(50) NOT NULL UNIQUE,
    product_type VARCHAR(30) NOT NULL,
    name VARCHAR(100) NOT NULL,
    price_krw INTEGER NOT NULL,
    duration_days INTEGER,
    billing_interval_days INTEGER,
    auto_renew_available BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    idea_view_daily_limit INTEGER,
    idea_view_total_limit INTEGER,

    project_create_daily_limit INTEGER,
    project_create_total_limit INTEGER,

    project_discard_unlimited BOOLEAN NOT NULL DEFAULT FALSE,

    project_apply_daily_limit INTEGER,
    project_apply_total_limit INTEGER,
    project_apply_unlimited BOOLEAN NOT NULL DEFAULT FALSE,
    project_apply_priority BOOLEAN NOT NULL DEFAULT FALSE,

    community_write_daily_limit INTEGER,
    community_write_unlimited BOOLEAN NOT NULL DEFAULT FALSE,
    community_comment_unlimited BOOLEAN NOT NULL DEFAULT TRUE,

    project_boost_total_limit INTEGER,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT payment_products_product_type_check
        CHECK (product_type IN ('SUBSCRIPTION', 'PASS'))
);

CREATE TABLE IF NOT EXISTS user_entitlements (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id BIGINT NOT NULL REFERENCES payment_products(id) ON DELETE RESTRICT,
    payment_id BIGINT REFERENCES payments(id) ON DELETE SET NULL,

    product_code VARCHAR(50) NOT NULL,
    product_type VARCHAR(30) NOT NULL,

    starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    next_renewal_at TIMESTAMPTZ,

    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    auto_renew_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    renewal_status VARCHAR(30) NOT NULL DEFAULT 'NONE',

    project_create_used INTEGER NOT NULL DEFAULT 0,
    project_apply_used INTEGER NOT NULL DEFAULT 0,
    idea_view_used INTEGER NOT NULL DEFAULT 0,
    project_boost_used INTEGER NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT user_entitlements_status_check
        CHECK (status IN ('ACTIVE', 'EXPIRED', 'CANCELED'))
);

CREATE TABLE IF NOT EXISTS user_usage_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    entitlement_id BIGINT REFERENCES user_entitlements(id) ON DELETE SET NULL,

    usage_type VARCHAR(50) NOT NULL,

    target_type VARCHAR(50),
    target_id BIGINT,

    used_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    usage_date DATE NOT NULL DEFAULT CURRENT_DATE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE payments
ADD COLUMN IF NOT EXISTS product_id BIGINT REFERENCES payment_products(id) ON DELETE SET NULL;

ALTER TABLE payments
ADD COLUMN IF NOT EXISTS product_code VARCHAR(50);

ALTER TABLE payments
ADD COLUMN IF NOT EXISTS product_type VARCHAR(30);

ALTER TABLE payments
ADD COLUMN IF NOT EXISTS entitlement_id BIGINT REFERENCES user_entitlements(id) ON DELETE SET NULL;

ALTER TABLE payment_products
ADD COLUMN IF NOT EXISTS billing_interval_days INTEGER;

ALTER TABLE payment_products
ADD COLUMN IF NOT EXISTS auto_renew_available BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE payment_products
ALTER COLUMN is_active SET DEFAULT TRUE;

ALTER TABLE user_entitlements
ADD COLUMN IF NOT EXISTS next_renewal_at TIMESTAMPTZ;

ALTER TABLE user_entitlements
ADD COLUMN IF NOT EXISTS auto_renew_enabled BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE user_entitlements
ADD COLUMN IF NOT EXISTS renewal_status VARCHAR(30) NOT NULL DEFAULT 'NONE';

ALTER TABLE applications
ADD COLUMN IF NOT EXISTS is_priority BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE projects
ADD COLUMN IF NOT EXISTS boosted_until TIMESTAMPTZ;

ALTER TABLE projects
ADD COLUMN IF NOT EXISTS boost_score INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_user_entitlements_user_active
ON user_entitlements(user_id, status, expires_at);

CREATE INDEX IF NOT EXISTS idx_user_entitlements_payment_id
ON user_entitlements(payment_id);

CREATE INDEX IF NOT EXISTS idx_user_usage_logs_user_type_date
ON user_usage_logs(user_id, usage_type, usage_date);

CREATE INDEX IF NOT EXISTS idx_user_usage_logs_entitlement_type
ON user_usage_logs(entitlement_id, usage_type);

CREATE INDEX IF NOT EXISTS idx_payments_product_code ON payments(product_code);

CREATE INDEX IF NOT EXISTS idx_projects_boosted_until ON projects(boosted_until);

INSERT INTO payment_products (
    product_code,
    product_type,
    name,
    price_krw,
    duration_days,
    billing_interval_days,
    auto_renew_available,
    is_active,
    idea_view_daily_limit,
    idea_view_total_limit,
    project_create_daily_limit,
    project_create_total_limit,
    project_discard_unlimited,
    project_apply_daily_limit,
    project_apply_total_limit,
    project_apply_unlimited,
    project_apply_priority,
    community_write_daily_limit,
    community_write_unlimited,
    community_comment_unlimited,
    project_boost_total_limit
)
VALUES
('PLUS_MONTHLY', 'SUBSCRIPTION', 'Devory Plus 월 구독', 7900, 30, 30, TRUE, TRUE, 3, NULL, 1, NULL, TRUE, NULL, NULL, TRUE, TRUE, NULL, TRUE, TRUE, 0),
('PRO_MONTHLY', 'SUBSCRIPTION', 'Devory Pro 월 구독', 12900, 30, 30, TRUE, TRUE, NULL, NULL, 3, NULL, TRUE, NULL, NULL, TRUE, TRUE, NULL, TRUE, TRUE, 4),
('PASS_1D', 'PASS', 'Devory 1일권', 1900, 1, NULL, FALSE, TRUE, NULL, NULL, NULL, 1, TRUE, NULL, 3, FALSE, FALSE, NULL, TRUE, TRUE, 0),
('PASS_3D', 'PASS', 'Devory 3일권', 2900, 3, NULL, FALSE, TRUE, NULL, NULL, 1, 2, TRUE, 3, 5, FALSE, FALSE, NULL, TRUE, TRUE, 0),
('PASS_7D', 'PASS', 'Devory 7일권', 4900, 7, NULL, FALSE, TRUE, NULL, NULL, 1, 3, TRUE, 3, 10, FALSE, FALSE, NULL, TRUE, TRUE, 0)
ON CONFLICT (product_code)
DO UPDATE SET
    product_type = EXCLUDED.product_type,
    name = EXCLUDED.name,
    price_krw = EXCLUDED.price_krw,
    duration_days = EXCLUDED.duration_days,
    billing_interval_days = EXCLUDED.billing_interval_days,
    auto_renew_available = EXCLUDED.auto_renew_available,
    is_active = EXCLUDED.is_active,
    idea_view_daily_limit = EXCLUDED.idea_view_daily_limit,
    idea_view_total_limit = EXCLUDED.idea_view_total_limit,
    project_create_daily_limit = EXCLUDED.project_create_daily_limit,
    project_create_total_limit = EXCLUDED.project_create_total_limit,
    project_discard_unlimited = EXCLUDED.project_discard_unlimited,
    project_apply_daily_limit = EXCLUDED.project_apply_daily_limit,
    project_apply_total_limit = EXCLUDED.project_apply_total_limit,
    project_apply_unlimited = EXCLUDED.project_apply_unlimited,
    project_apply_priority = EXCLUDED.project_apply_priority,
    community_write_daily_limit = EXCLUDED.community_write_daily_limit,
    community_write_unlimited = EXCLUDED.community_write_unlimited,
    community_comment_unlimited = EXCLUDED.community_comment_unlimited,
    project_boost_total_limit = EXCLUDED.project_boost_total_limit,
    updated_at = now();
