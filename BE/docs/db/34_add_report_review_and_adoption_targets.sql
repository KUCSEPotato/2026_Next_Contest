-- Add review and adoption request targets to reports.

ALTER TABLE reports
ADD COLUMN IF NOT EXISTS target_review_id BIGINT REFERENCES reviews(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS target_adoption_request_id BIGINT REFERENCES adoption_requests(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_reports_target_review_id ON reports(target_review_id);
CREATE INDEX IF NOT EXISTS idx_reports_target_adoption_request_id ON reports(target_adoption_request_id);
