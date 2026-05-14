ALTER TABLE todos
DROP CONSTRAINT IF EXISTS todos_priority_check;

ALTER TABLE todos
ADD CONSTRAINT todos_priority_check CHECK (priority BETWEEN 1 AND 1000);
