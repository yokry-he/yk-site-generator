-- SiteForge MySQL 8 transactional application-state adapter.
-- This table is intentionally separate from the normalized domain tables.
-- It provides a safe multi-instance migration bridge while route repositories
-- are progressively moved to domain-specific SQL.

CREATE TABLE IF NOT EXISTS siteforge_app_state (
  state_key VARCHAR(64) NOT NULL,
  revision BIGINT UNSIGNED NOT NULL DEFAULT 0,
  schema_version INT UNSIGNED NOT NULL,
  payload LONGTEXT NOT NULL,
  checksum CHAR(64) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (state_key),
  CONSTRAINT siteforge_app_state_payload_json CHECK (JSON_VALID(payload))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
