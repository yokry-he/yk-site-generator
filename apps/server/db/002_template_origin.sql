-- Track which official template created a project.
-- Template IDs are stable application identifiers such as `tpl-aurora-saas`.

ALTER TABLE projects
  ADD COLUMN template_id VARCHAR(80) NULL AFTER requirement,
  ADD KEY projects_template_updated_idx (template_id, updated_at DESC);
