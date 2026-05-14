-- Allow debit transactions in coin_transactions.
-- Existing code records coin spending as a negative amount and coin rewards
-- as a positive amount, so the legacy amount > 0 check breaks spending flows.

BEGIN;

ALTER TABLE coin_transactions
    DROP CONSTRAINT IF EXISTS coin_transactions_amount_check;

ALTER TABLE coin_transactions
    ADD CONSTRAINT coin_transactions_amount_check CHECK (amount <> 0);

COMMIT;
