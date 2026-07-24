-- SiteForge MySQL 8.0+ production baseline
-- Engine: InnoDB · Charset: utf8mb4 · IDs are generated in the application layer.
-- The current single-instance development adapter can still use the JSON data store.

SET NAMES utf8mb4 COLLATE utf8mb4_0900_ai_ci;
SET time_zone = '+00:00';

CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) NOT NULL,
  email VARCHAR(320) NOT NULL,
  role VARCHAR(24) NOT NULL DEFAULT 'user',
  status VARCHAR(24) NOT NULL DEFAULT 'active',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY users_email_unique (email),
  KEY users_status_created_idx (status, created_at),
  CONSTRAINT users_role_check CHECK (role IN ('user', 'admin', 'support')),
  CONSTRAINT users_status_check CHECK (status IN ('active', 'suspended', 'deleted'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS verification_codes (
  id CHAR(36) NOT NULL,
  email VARCHAR(320) NOT NULL,
  code_hash VARCHAR(255) NOT NULL,
  attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  expires_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  KEY verification_codes_email_created_idx (email, created_at DESC),
  KEY verification_codes_expires_idx (expires_at),
  CONSTRAINT verification_codes_attempts_check CHECK (attempts <= 5)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS sessions (
  id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  refresh_token_hash VARCHAR(255) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  expires_at DATETIME(3) NOT NULL,
  last_used_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  revoked_at DATETIME(3) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY sessions_refresh_hash_unique (refresh_token_hash),
  KEY sessions_user_active_idx (user_id, revoked_at, expires_at),
  KEY sessions_expires_idx (expires_at),
  CONSTRAINT sessions_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS projects (
  id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  title VARCHAR(120) NOT NULL,
  site_type VARCHAR(40) NOT NULL,
  requirement TEXT NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY projects_user_updated_idx (user_id, updated_at DESC),
  CONSTRAINT projects_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS project_versions (
  id CHAR(36) NOT NULL,
  project_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  version INT UNSIGNED NOT NULL,
  html LONGTEXT NOT NULL,
  source VARCHAR(24) NOT NULL,
  instruction TEXT NULL,
  model VARCHAR(120) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY project_versions_project_version_unique (project_id, version),
  KEY project_versions_project_created_idx (project_id, created_at DESC),
  KEY project_versions_user_created_idx (user_id, created_at DESC),
  CONSTRAINT project_versions_source_check CHECK (source IN ('generate', 'iterate', 'editor', 'import')),
  CONSTRAINT project_versions_project_fk FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  CONSTRAINT project_versions_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS usage_events (
  id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  action VARCHAR(24) NOT NULL,
  units INT UNSIGNED NOT NULL DEFAULT 1,
  site_type VARCHAR(40) NULL,
  model VARCHAR(120) NULL,
  request_id VARCHAR(64) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY usage_events_user_month_idx (user_id, created_at DESC),
  KEY usage_events_request_idx (request_id),
  CONSTRAINT usage_events_action_check CHECK (action IN ('generate', 'iterate', 'publish')),
  CONSTRAINT usage_events_units_check CHECK (units > 0),
  CONSTRAINT usage_events_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS publications (
  id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  project_id CHAR(36) NULL,
  version_id CHAR(36) NULL,
  slug VARCHAR(48) NOT NULL,
  title VARCHAR(120) NOT NULL,
  artifact_key VARCHAR(512) NULL,
  html LONGTEXT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'published',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  published_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY publications_slug_unique (slug),
  KEY publications_user_updated_idx (user_id, updated_at DESC),
  KEY publications_project_idx (project_id),
  CONSTRAINT publications_status_check CHECK (status IN ('published', 'offline')),
  CONSTRAINT publications_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT publications_project_fk FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  CONSTRAINT publications_version_fk FOREIGN KEY (version_id) REFERENCES project_versions(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS brand_kits (
  id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  name VARCHAR(80) NOT NULL,
  description VARCHAR(240) NOT NULL DEFAULT '',
  logo_data MEDIUMTEXT NULL,
  favicon_data MEDIUMTEXT NULL,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  primary_color CHAR(7) NOT NULL,
  secondary_color CHAR(7) NOT NULL,
  accent_color CHAR(7) NOT NULL,
  background_color CHAR(7) NOT NULL,
  surface_color CHAR(7) NOT NULL,
  text_color CHAR(7) NOT NULL,
  muted_color CHAR(7) NOT NULL,
  heading_font VARCHAR(32) NOT NULL,
  body_font VARCHAR(32) NOT NULL,
  radius TINYINT UNSIGNED NOT NULL DEFAULT 14,
  button_style VARCHAR(16) NOT NULL DEFAULT 'solid',
  shadow_style VARCHAR(16) NOT NULL DEFAULT 'soft',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY brand_kits_user_default_idx (user_id, is_default, updated_at DESC),
  CONSTRAINT brand_kits_button_check CHECK (button_style IN ('solid', 'soft', 'outline')),
  CONSTRAINT brand_kits_shadow_check CHECK (shadow_style IN ('none', 'soft', 'medium', 'dramatic')),
  CONSTRAINT brand_kits_radius_check CHECK (radius <= 32),
  CONSTRAINT brand_kits_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS template_categories (
  id CHAR(36) NOT NULL,
  slug VARCHAR(64) NOT NULL,
  name VARCHAR(80) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY template_categories_slug_unique (slug),
  KEY template_categories_sort_idx (sort_order, name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS templates (
  id CHAR(36) NOT NULL,
  slug VARCHAR(80) NOT NULL,
  name VARCHAR(120) NOT NULL,
  description VARCHAR(500) NOT NULL DEFAULT '',
  site_type VARCHAR(40) NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'draft',
  preview_image_url VARCHAR(1000) NULL,
  html LONGTEXT NOT NULL,
  variables_schema JSON NULL,
  metadata JSON NULL,
  version INT UNSIGNED NOT NULL DEFAULT 1,
  featured BOOLEAN NOT NULL DEFAULT FALSE,
  use_count BIGINT UNSIGNED NOT NULL DEFAULT 0,
  created_by CHAR(36) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY templates_slug_unique (slug),
  KEY templates_status_featured_idx (status, featured, updated_at DESC),
  KEY templates_site_type_idx (site_type, status),
  CONSTRAINT templates_status_check CHECK (status IN ('draft', 'published', 'archived')),
  CONSTRAINT templates_creator_fk FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS template_category_links (
  template_id CHAR(36) NOT NULL,
  category_id CHAR(36) NOT NULL,
  PRIMARY KEY (template_id, category_id),
  CONSTRAINT template_category_links_template_fk FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE CASCADE,
  CONSTRAINT template_category_links_category_fk FOREIGN KEY (category_id) REFERENCES template_categories(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS audit_logs (
  id CHAR(36) NOT NULL,
  actor_user_id CHAR(36) NULL,
  actor_role VARCHAR(24) NULL,
  action VARCHAR(80) NOT NULL,
  resource_type VARCHAR(64) NOT NULL,
  resource_id VARCHAR(128) NULL,
  request_id VARCHAR(64) NULL,
  ip_address VARCHAR(64) NULL,
  user_agent VARCHAR(500) NULL,
  outcome VARCHAR(16) NOT NULL DEFAULT 'success',
  before_data JSON NULL,
  after_data JSON NULL,
  error_code VARCHAR(80) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY audit_logs_actor_created_idx (actor_user_id, created_at DESC),
  KEY audit_logs_resource_created_idx (resource_type, resource_id, created_at DESC),
  KEY audit_logs_request_idx (request_id),
  CONSTRAINT audit_logs_outcome_check CHECK (outcome IN ('success', 'failure')),
  CONSTRAINT audit_logs_actor_fk FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS feedback (
  id CHAR(36) NOT NULL,
  user_id CHAR(36) NULL,
  project_id CHAR(36) NULL,
  version_id CHAR(36) NULL,
  sentiment VARCHAR(16) NOT NULL,
  category VARCHAR(48) NULL,
  message TEXT NULL,
  site_type VARCHAR(40) NULL,
  model VARCHAR(120) NULL,
  prompt_version VARCHAR(64) NULL,
  metadata JSON NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'open',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY feedback_status_created_idx (status, created_at DESC),
  KEY feedback_project_created_idx (project_id, created_at DESC),
  KEY feedback_quality_idx (site_type, model, sentiment, created_at DESC),
  CONSTRAINT feedback_sentiment_check CHECK (sentiment IN ('positive', 'negative')),
  CONSTRAINT feedback_status_check CHECK (status IN ('open', 'reviewed', 'resolved', 'dismissed')),
  CONSTRAINT feedback_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT feedback_project_fk FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
  CONSTRAINT feedback_version_fk FOREIGN KEY (version_id) REFERENCES project_versions(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS onboarding_progress (
  user_id CHAR(36) NOT NULL,
  current_step VARCHAR(48) NOT NULL DEFAULT 'welcome',
  completed_steps JSON NOT NULL,
  context JSON NULL,
  completed_at DATETIME(3) NULL,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (user_id),
  CONSTRAINT onboarding_progress_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS feature_flags (
  flag_key VARCHAR(100) NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  rollout_percent TINYINT UNSIGNED NOT NULL DEFAULT 0,
  rules JSON NULL,
  description VARCHAR(500) NOT NULL DEFAULT '',
  updated_by CHAR(36) NULL,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (flag_key),
  CONSTRAINT feature_flags_rollout_check CHECK (rollout_percent <= 100),
  CONSTRAINT feature_flags_updated_by_fk FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS system_events (
  id CHAR(36) NOT NULL,
  event_name VARCHAR(100) NOT NULL,
  level VARCHAR(16) NOT NULL DEFAULT 'info',
  request_id VARCHAR(64) NULL,
  user_id CHAR(36) NULL,
  duration_ms INT UNSIGNED NULL,
  properties JSON NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY system_events_name_created_idx (event_name, created_at DESC),
  KEY system_events_level_created_idx (level, created_at DESC),
  KEY system_events_request_idx (request_id),
  CONSTRAINT system_events_level_check CHECK (level IN ('debug', 'info', 'warn', 'error')),
  CONSTRAINT system_events_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Recommended scheduled cleanup:
-- DELETE FROM verification_codes WHERE expires_at < UTC_TIMESTAMP(3);
-- DELETE FROM sessions WHERE expires_at < UTC_TIMESTAMP(3) OR revoked_at < UTC_TIMESTAMP(3) - INTERVAL 30 DAY;
