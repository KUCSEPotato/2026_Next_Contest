BEGIN;

ALTER TABLE ideas ADD COLUMN IF NOT EXISTS tech_stack JSON;
ALTER TABLE ideas ADD COLUMN IF NOT EXISTS hashtags JSON;

UPDATE ideas
SET tech_stack = '[]'::json
WHERE tech_stack IS NULL;

UPDATE ideas
SET hashtags = '[]'::json
WHERE hashtags IS NULL;

ALTER TABLE ideas
    ALTER COLUMN tech_stack SET DEFAULT '[]'::json,
    ALTER COLUMN hashtags SET DEFAULT '[]'::json;

ALTER TABLE ideas
    ALTER COLUMN tech_stack SET NOT NULL,
    ALTER COLUMN hashtags SET NOT NULL;

COMMIT;
