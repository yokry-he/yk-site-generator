-- SiteForge V1 PostgreSQL 基线结构
-- 当前单实例开发环境可使用文件适配器;正式多实例部署按此结构迁移。

create extension if not exists pgcrypto;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint users_email_lowercase check (email = lower(email))
);
create unique index if not exists users_email_unique on users (lower(email));

create table if not exists verification_codes (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  code_hash text not null,
  attempts integer not null default 0 check (attempts between 0 and 5),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index if not exists verification_codes_email_created_idx on verification_codes (email, created_at desc);
create index if not exists verification_codes_expires_idx on verification_codes (expires_at);

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  refresh_token_hash text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  last_used_at timestamptz not null default now(),
  revoked_at timestamptz
);
create index if not exists sessions_user_active_idx on sessions (user_id, expires_at desc) where revoked_at is null;

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  title varchar(120) not null,
  site_type varchar(40) not null,
  requirement text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists projects_user_updated_idx on projects (user_id, updated_at desc);

create type project_version_source as enum ('generate', 'iterate', 'editor', 'import');
create table if not exists project_versions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  version integer not null check (version > 0),
  html text not null,
  source project_version_source not null,
  instruction text,
  model varchar(120),
  created_at timestamptz not null default now(),
  unique (project_id, version)
);
create index if not exists project_versions_project_version_idx on project_versions (project_id, version desc);

create type usage_action as enum ('generate', 'iterate', 'publish');
create table if not exists usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  action usage_action not null,
  units integer not null default 1 check (units > 0),
  site_type varchar(40),
  model varchar(120),
  created_at timestamptz not null default now()
);
create index if not exists usage_events_user_month_idx on usage_events (user_id, created_at desc);

create type publication_status as enum ('published', 'offline');
create table if not exists publications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  project_id uuid references projects(id) on delete cascade,
  version_id uuid references project_versions(id) on delete set null,
  slug varchar(48) not null unique,
  title varchar(120) not null,
  artifact_key text not null,
  status publication_status not null default 'published',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz not null default now()
);
create index if not exists publications_user_updated_idx on publications (user_id, updated_at desc);

-- 清理任务建议:
-- delete from verification_codes where expires_at < now();
-- delete from sessions where expires_at < now() or revoked_at < now() - interval '30 days';
