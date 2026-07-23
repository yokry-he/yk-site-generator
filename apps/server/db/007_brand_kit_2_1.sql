-- Brand Kit 2.1 optional identity, layout and component-style metadata.
SET NAMES utf8mb4 COLLATE utf8mb4_0900_ai_ci;
SET time_zone = '+00:00';

ALTER TABLE brand_kits
  ADD COLUMN logo_dark_data MEDIUMTEXT NULL AFTER logo_data,
  ADD COLUMN logo_vertical_data MEDIUMTEXT NULL AFTER logo_dark_data,
  ADD COLUMN logo_mark_data MEDIUMTEXT NULL AFTER logo_vertical_data,
  ADD COLUMN og_image_data MEDIUMTEXT NULL AFTER favicon_data,
  ADD COLUMN company_name VARCHAR(120) NULL AFTER og_image_data,
  ADD COLUMN company_description VARCHAR(800) NULL AFTER company_name,
  ADD COLUMN contact_email VARCHAR(320) NULL AFTER company_description,
  ADD COLUMN contact_phone VARCHAR(60) NULL AFTER contact_email,
  ADD COLUMN address VARCHAR(300) NULL AFTER contact_phone,
  ADD COLUMN social_links JSON NULL AFTER address,
  ADD COLUMN heading_scale DECIMAL(4,2) NULL AFTER body_font,
  ADD COLUMN spacing_density VARCHAR(24) NULL AFTER heading_scale,
  ADD COLUMN content_width SMALLINT UNSIGNED NULL AFTER spacing_density,
  ADD COLUMN navigation_style VARCHAR(24) NULL AFTER content_width,
  ADD COLUMN input_style VARCHAR(24) NULL AFTER navigation_style,
  ADD COLUMN image_style VARCHAR(24) NULL AFTER input_style,
  ADD COLUMN icon_style VARCHAR(24) NULL AFTER image_style,
  ADD CONSTRAINT brand_kits_heading_scale_check CHECK (heading_scale IS NULL OR (heading_scale >= 0.80 AND heading_scale <= 1.35)),
  ADD CONSTRAINT brand_kits_spacing_density_check CHECK (spacing_density IS NULL OR spacing_density IN ('compact', 'comfortable', 'spacious')),
  ADD CONSTRAINT brand_kits_content_width_check CHECK (content_width IS NULL OR (content_width >= 720 AND content_width <= 1600)),
  ADD CONSTRAINT brand_kits_navigation_style_check CHECK (navigation_style IS NULL OR navigation_style IN ('minimal', 'pill', 'bordered')),
  ADD CONSTRAINT brand_kits_input_style_check CHECK (input_style IS NULL OR input_style IN ('soft', 'outline', 'underline')),
  ADD CONSTRAINT brand_kits_image_style_check CHECK (image_style IS NULL OR image_style IN ('square', 'rounded', 'organic')),
  ADD CONSTRAINT brand_kits_icon_style_check CHECK (icon_style IS NULL OR icon_style IN ('outline', 'solid', 'duotone'));
