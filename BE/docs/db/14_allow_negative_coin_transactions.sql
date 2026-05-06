-- Migration: allow negative coin transactions for spending events

BEGIN;

ALTER TABLE coin_transactions
    DROP CONSTRAINT IF EXISTS coin_transactions_amount_check;

ALTER TABLE coin_transactions
    ADD CONSTRAINT coin_transactions_amount_check CHECK (amount <> 0);

COMMIT;