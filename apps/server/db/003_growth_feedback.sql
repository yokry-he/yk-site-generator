-- Growth and quality feedback alignment.
-- Apply after 001_initial.sql and 002_template_origin.sql.

ALTER TABLE feedback
  ADD COLUMN categories JSON NULL AFTER sentiment,
  DROP COLUMN category,
  ADD UNIQUE KEY feedback_user_version_unique (user_id, version_id);

ALTER TABLE onboarding_progress
  ADD COLUMN dismissed_at DATETIME(3) NULL AFTER completed_at;
