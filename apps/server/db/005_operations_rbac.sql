-- SiteForge MySQL 8 operations and rollout metadata

CREATE TABLE IF NOT EXISTS official_template_operations (
  template_id VARCHAR(80) NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'published',
  featured BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INT UNSIGNED NOT NULL DEFAULT 100,
  version INT UNSIGNED NOT NULL DEFAULT 1,
  updated_by CHAR(36) NOT NULL,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (template_id),
  KEY official_template_operations_status_sort_idx (status, sort_order, featured),
  CONSTRAINT official_template_operations_status_check CHECK (status IN ('draft', 'published', 'archived')),
  CONSTRAINT official_template_operations_user_fk FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

ALTER TABLE feature_flags
  ADD COLUMN version INT UNSIGNED NOT NULL DEFAULT 1 AFTER description,
  ADD COLUMN starts_at DATETIME(3) NULL AFTER rules,
  ADD COLUMN expires_at DATETIME(3) NULL AFTER starts_at,
  ADD KEY feature_flags_enabled_window_idx (enabled, starts_at, expires_at);
