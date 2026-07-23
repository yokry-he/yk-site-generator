-- Product-completion metadata for the editor, workspace, brand library and template center.
SET NAMES utf8mb4 COLLATE utf8mb4_0900_ai_ci;
SET time_zone = '+00:00';

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS lifecycle_status VARCHAR(24) NOT NULL DEFAULT 'active' AFTER requirement,
  ADD COLUMN IF NOT EXISTS starred BOOLEAN NOT NULL DEFAULT FALSE AFTER lifecycle_status,
  ADD COLUMN IF NOT EXISTS opened_at DATETIME(3) NULL AFTER starred,
  ADD COLUMN IF NOT EXISTS duplicated_from_id CHAR(36) NULL AFTER opened_at,
  ADD COLUMN IF NOT EXISTS brand_kit_id CHAR(36) NULL AFTER duplicated_from_id,
  ADD COLUMN IF NOT EXISTS cover_data MEDIUMTEXT NULL AFTER brand_kit_id;

CREATE INDEX projects_user_status_updated_idx ON projects (user_id, lifecycle_status, updated_at DESC);
CREATE INDEX projects_user_starred_updated_idx ON projects (user_id, starred, updated_at DESC);

ALTER TABLE project_versions
  ADD COLUMN IF NOT EXISTS name VARCHAR(80) NULL AFTER model,
  ADD COLUMN IF NOT EXISTS note VARCHAR(500) NULL AFTER name,
  ADD COLUMN IF NOT EXISTS starred BOOLEAN NOT NULL DEFAULT FALSE AFTER note,
  ADD COLUMN IF NOT EXISTS parent_version_id CHAR(36) NULL AFTER starred,
  ADD COLUMN IF NOT EXISTS change_summary JSON NULL AFTER parent_version_id;

CREATE INDEX project_versions_project_starred_idx ON project_versions (project_id, starred, version DESC);

CREATE TABLE IF NOT EXISTS brand_assets (
  id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  brand_kit_id CHAR(36) NULL,
  kind VARCHAR(24) NOT NULL,
  name VARCHAR(100) NOT NULL,
  data_url MEDIUMTEXT NOT NULL,
  alt VARCHAR(240) NULL,
  tags JSON NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY brand_assets_user_kind_updated_idx (user_id, kind, updated_at DESC),
  KEY brand_assets_brand_kit_idx (brand_kit_id, updated_at DESC),
  CONSTRAINT brand_assets_kind_check CHECK (kind IN ('logo', 'image', 'icon', 'background', 'document')),
  CONSTRAINT brand_assets_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT brand_assets_brand_kit_fk FOREIGN KEY (brand_kit_id) REFERENCES brand_kits(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS template_favorites (
  user_id CHAR(36) NOT NULL,
  template_id VARCHAR(80) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (user_id, template_id),
  KEY template_favorites_user_created_idx (user_id, created_at DESC),
  CONSTRAINT template_favorites_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
