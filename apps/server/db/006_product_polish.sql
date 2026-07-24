-- Schema v6 product-completion metadata for the editor, workspace, brand library and template center.
-- Numbered migrations run exactly once in order, so standard MySQL 8.4 ADD COLUMN syntax is used.
-- This batch is validated by the real MySQL CI migration, concurrency and rollback job.
SET NAMES utf8mb4 COLLATE utf8mb4_0900_ai_ci;
SET time_zone = '+00:00';

ALTER TABLE projects
  ADD COLUMN lifecycle_status VARCHAR(24) NOT NULL DEFAULT 'active' AFTER requirement,
  ADD COLUMN starred BOOLEAN NOT NULL DEFAULT FALSE AFTER lifecycle_status,
  ADD COLUMN opened_at DATETIME(3) NULL AFTER starred,
  ADD COLUMN duplicated_from_id CHAR(36) NULL AFTER opened_at,
  ADD COLUMN brand_kit_id CHAR(36) NULL AFTER duplicated_from_id,
  ADD COLUMN cover_data MEDIUMTEXT NULL AFTER brand_kit_id,
  ADD KEY projects_user_status_updated_idx (user_id, lifecycle_status, updated_at DESC),
  ADD KEY projects_user_starred_updated_idx (user_id, starred, updated_at DESC),
  ADD KEY projects_duplicated_from_idx (duplicated_from_id),
  ADD KEY projects_brand_kit_idx (brand_kit_id),
  ADD CONSTRAINT projects_lifecycle_status_check CHECK (lifecycle_status IN ('active', 'archived', 'trashed')),
  ADD CONSTRAINT projects_duplicated_from_fk FOREIGN KEY (duplicated_from_id) REFERENCES projects(id) ON DELETE SET NULL,
  ADD CONSTRAINT projects_brand_kit_fk FOREIGN KEY (brand_kit_id) REFERENCES brand_kits(id) ON DELETE SET NULL;

ALTER TABLE project_versions
  ADD COLUMN name VARCHAR(80) NULL AFTER model,
  ADD COLUMN note VARCHAR(500) NULL AFTER name,
  ADD COLUMN starred BOOLEAN NOT NULL DEFAULT FALSE AFTER note,
  ADD COLUMN parent_version_id CHAR(36) NULL AFTER starred,
  ADD COLUMN change_summary JSON NULL AFTER parent_version_id,
  ADD KEY project_versions_project_starred_idx (project_id, starred, version DESC),
  ADD KEY project_versions_parent_idx (parent_version_id),
  ADD CONSTRAINT project_versions_parent_fk FOREIGN KEY (parent_version_id) REFERENCES project_versions(id) ON DELETE SET NULL;

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
