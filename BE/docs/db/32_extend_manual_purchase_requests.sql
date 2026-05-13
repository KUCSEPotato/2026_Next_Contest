-- Allow manual purchase requests for both waterdrops and paid entitlements.

ALTER TABLE coin_purchase_requests
ADD COLUMN IF NOT EXISTS request_type VARCHAR(30) NOT NULL DEFAULT 'COIN';

ALTER TABLE coin_purchase_requests
ADD COLUMN IF NOT EXISTS product_code VARCHAR(50);

ALTER TABLE coin_purchase_requests
ADD COLUMN IF NOT EXISTS product_name VARCHAR(100);

ALTER TABLE coin_purchase_requests
ADD COLUMN IF NOT EXISTS product_type VARCHAR(30);

ALTER TABLE coin_purchase_requests
ADD COLUMN IF NOT EXISTS entitlement_days INTEGER;

ALTER TABLE coin_purchase_requests
ALTER COLUMN coin_amount SET DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_coin_purchase_requests_request_type
    ON coin_purchase_requests(request_type);
