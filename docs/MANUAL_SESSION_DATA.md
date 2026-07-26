# 持久化用户与 Session 数据层 / Persistent User and Session Data Layer

[中文](#中文) · [English](#english)

---

## 中文

### 定位

`/projects/new` 的角色权限步骤可以选择生成持久化用户与 Session 数据层。该开关不会调用 AI，也不会改变当前已经可用的环境变量 Bearer Token 路由保护。

本阶段的目标是先让五套后端拥有一致、可迁移的数据结构和安全参数，再在后续阶段接入密码登录、退出、轮换和撤销运行时。生成项目会明确标记 `runtime: not-wired`，不会宣称尚未实现的认证端点已经可用。

### 可视化配置

启用“生成持久化用户与 Session 数据层”后，可以配置：

- Session 有效期：900 到 2,592,000 秒
- 单用户活动 Session 上限：1 到 20
- 默认值分别为 28,800 秒和 5 个活动 Session

配置会写入 `siteforge.session.json`、`.env.example` 和生成工程内的 `SESSION_SECURITY.md`。

### 统一数据模型

五套后端统一生成两张表：

#### `auth_users`

- `id`
- `email`，唯一
- `password_hash`
- `role`
- `disabled`
- `created_at`
- `updated_at`

#### `auth_sessions`

- `id`
- `token_hash`，唯一
- `user_id`，引用 `auth_users.id`
- `expires_at`
- `revoked_at`
- `last_used_at`
- `created_at`

删除用户时会级联删除其 Session。`user_id` 与 `expires_at` 建立索引，支持用户 Session 列表、过期清理和并发上限处理。

### 五套后端输出

- Hono + Drizzle：Schema 表定义和数据库对应的 SQL Migration
- NestJS + Prisma：`AuthUser`、`AuthSession` Model、唯一约束与索引
- FastAPI + SQLAlchemy：ORM Model 和 Alembic `0002` Migration
- Spring Boot + JPA：Flyway `V2` Migration
- Gin + GORM：GORM Model、AutoMigrate 注册和 Goose `00002` Migration

SQLite 使用整数自增主键和 ISO 时间文本；PostgreSQL 使用 `BIGSERIAL` 与 `TIMESTAMPTZ`。外键类型与主键类型保持一致。

### 密码安全协议

`siteforge.session.json` 记录下一阶段运行时必须遵循的密码格式：

```text
PBKDF2-HMAC-SHA256
600,000 iterations
16-byte random salt
32-byte derived key
```

存储格式会包含算法、迭代次数、盐和派生结果，便于未来逐步升级工作因子。密码不得以明文、可逆密文或快速 SHA-256 摘要保存。

### Session 安全协议

- 每个客户端 Token 使用 32 字节密码学随机数
- 数据库只保存 Token 的 SHA-256 摘要
- 原始 Token 只在创建或轮换响应中出现一次
- 撤销通过 `revoked_at` 表示
- 轮换应在同一事务中创建新 Session 并撤销旧 Session
- 过期、撤销、用户禁用和活动 Session 上限必须由服务端执行

### 环境变量

生成工程新增：

```text
AUTH_BOOTSTRAP_EMAIL
AUTH_BOOTSTRAP_PASSWORD
AUTH_SESSION_TTL_SECONDS
AUTH_MAX_ACTIVE_SESSIONS
```

`AUTH_BOOTSTRAP_PASSWORD` 只能通过 Secret 管理注入。示例值不是生产密码，不能原样部署。

### 当前边界

本阶段只完成数据结构、迁移、配置和安全协议。实际运行时仍由 `AUTH_IDENTITIES_JSON` Bearer Token 保护，不包含：

- 密码登录和退出端点
- Session Token 创建、轮换和撤销端点
- 管理员引导写入逻辑
- 注册、密码找回和邮箱验证
- MFA、OAuth 或 OIDC
- Session 清理任务和登录限流

这些能力会在下一阶段基于当前数据模型接线。

---

## English

### Purpose

The role-permission step at `/projects/new` can optionally generate a persistent user and session data layer. This option does not call AI and does not replace the currently working environment-backed bearer-token route protection.

This phase first establishes a consistent, migratable data structure and security protocol across all five backend profiles. Password login, logout, rotation, and revocation runtime behavior is wired in the next phase. Generated projects explicitly mark the session runtime as `not-wired` and do not claim that unavailable authentication endpoints already exist.

### Visual configuration

After enabling “Generate persistent user and session data,” the user can configure:

- a session lifetime from 900 to 2,592,000 seconds
- an active-session limit from 1 to 20 per user
- defaults of 28,800 seconds and 5 active sessions

The values are written to `siteforge.session.json`, `.env.example`, and the generated `SESSION_SECURITY.md`.

### Shared data model

Every backend generates two tables.

#### `auth_users`

- `id`
- unique `email`
- `password_hash`
- `role`
- `disabled`
- `created_at`
- `updated_at`

#### `auth_sessions`

- `id`
- unique `token_hash`
- `user_id` referencing `auth_users.id`
- `expires_at`
- `revoked_at`
- `last_used_at`
- `created_at`

Deleting a user cascades to that user's sessions. Indexes on `user_id` and `expires_at` support session listing, expiry cleanup, and active-session-limit enforcement.

### Five backend outputs

- Hono + Drizzle: schema tables and database-specific SQL migration
- NestJS + Prisma: `AuthUser` and `AuthSession` models, unique constraints, and indexes
- FastAPI + SQLAlchemy: ORM models and Alembic `0002` migration
- Spring Boot + JPA: Flyway `V2` migration
- Gin + GORM: GORM models, AutoMigrate registration, and Goose `00002` migration

SQLite uses auto-incrementing integer keys and ISO time text. PostgreSQL uses `BIGSERIAL` and `TIMESTAMPTZ`. Foreign-key types match their primary-key types.

### Password security protocol

`siteforge.session.json` records the password format required by the next runtime phase:

```text
PBKDF2-HMAC-SHA256
600,000 iterations
16-byte random salt
32-byte derived key
```

The stored format contains the algorithm, iteration count, salt, and derived result so the work factor can be upgraded over time. Passwords must not be stored as plaintext, reversible ciphertext, or a fast SHA-256 digest.

### Session security protocol

- each client token contains 32 bytes of cryptographic randomness
- the database stores only the SHA-256 token digest
- the raw token appears only once in a creation or rotation response
- revocation uses `revoked_at`
- rotation should create the new session and revoke the old session in one transaction
- expiry, revocation, user disabling, and active-session limits must be enforced server-side

### Environment variables

Generated projects add:

```text
AUTH_BOOTSTRAP_EMAIL
AUTH_BOOTSTRAP_PASSWORD
AUTH_SESSION_TTL_SECONDS
AUTH_MAX_ACTIVE_SESSIONS
```

`AUTH_BOOTSTRAP_PASSWORD` must be injected through secret management. The example value is not a production password and must not be deployed unchanged.

### Current boundary

This phase completes the data structures, migrations, configuration, and security protocol only. Runtime protection still uses `AUTH_IDENTITIES_JSON` bearer tokens and does not yet include:

- password login or logout endpoints
- session-token creation, rotation, or revocation endpoints
- administrator bootstrap persistence
- registration, password recovery, or email verification
- MFA, OAuth, or OIDC
- session cleanup jobs or login rate limiting

Those capabilities are wired in the next phase on top of this data model.
