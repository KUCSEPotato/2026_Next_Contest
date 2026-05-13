-- Add comment targets to reports.
-- Run after 26_add_report_target_scope_fields.sql.

ALTER TABLE reports
    ADD COLUMN IF NOT EXISTS target_comment_id BIGINT REFERENCES community_post_comments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_reports_target_comment_id ON reports(target_comment_id);
