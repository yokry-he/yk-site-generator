# 持久化用户与 Session 数据 / Persistent User and Session Data

[中文](#中文) · [English](#english)

---

## 中文

### 定位

当 `/projects/new` 启用“持久化用户与 Session 数据层”时，SiteForge 会为五套后端生成相同的身份数据协议：

```text
auth_users
auth_sessions
```

该数据层现在已经由 [`MANUAL_SESSION_RUNTIME.md`](./MANUAL_SESSION_RUNTIME.md) 中的登录、轮换、退出和撤销运行时使用。关闭“生成认证与路由权限代码”时仍可以只生成 Schema 和 Migration；此时 `siteforge.session.json` 会保持 `schema-ready / not-wired`。

### `auth_users`

| 字段 | 含义 |
| --- | --- |
| `id` | 数据库原生自增主键 |
| `email` | 规范化后的登录邮箱，唯一 |
| `password_hash` | 不可逆密码派生结果 |
| `role` | 角色设计器中的角色标识 |
| `disabled` | 禁止登录和 Session 使用 |
| `created_at` | 创建时间 |
| `updated_at` | 修改时间 |

### `auth_sessions`

| 字段 | 含义 |
| --- | --- |
| `id` | 数据库原生自增主键 |
| `token_hash` | 原始 Token 的 SHA-256 摘要，唯一 |
| `user_id` | 指向 `auth_users.id` |
| `expires_at` | 强制到期时间 |
| `revoked_at` | 主动撤销时间，空值表示未撤销 |
| `last_used_at` | 最近一次认证使用时间 |
| `created_at` | 创建时间 |

共同约束：

- 删除用户时级联删除 Session。
- `user_id` 与 `expires_at` 有索引。
- 邮箱和 Token 摘要有唯一约束。
- PostgreSQL 使用 `BIGSERIAL / BIGINT`；SQLite 使用匹配的 `INTEGER`。

### 五套输出

- Hono + Drizzle：`schema.ts` 和 `drizzle/0002_auth_identity_sessions.sql`
- NestJS + Prisma：`AuthUser`、`AuthSession` Model
- FastAPI + SQLAlchemy：ORM Model 和 Alembic `0002`
- Spring Boot + JPA：Flyway `V2`
- Gin + GORM：Model、AutoMigrate 和 Goose `00002`

### 密码和 Session 参数

生成协议固定采用：

```text
PBKDF2-HMAC-SHA256
600,000 iterations
16-byte random salt
32-byte derived key
32-byte random session token
SHA-256 token digest storage
```

每条密码记录保存自己的迭代次数和随机盐，以便未来升级工作因子。原始 Session Token 不写入数据库。

### 生成文件

- `siteforge.session.json`：机器可读状态、参数、端点和兼容策略
- `SESSION_SECURITY.md`：生成工程内的中英双语运行说明
- `.env.example` 中的引导和 Session 配置变量

### 安全边界

真实引导密码只能通过 Secret 管理注入。数据库备份包含密码哈希和 Token 摘要，仍应加密、限制访问并纳入保留与删除策略。

本数据层不等同于公开注册、密码找回、邮箱验证、MFA、OAuth/OIDC、设备管理或登录风险控制；这些仍属于后续能力。

---

## English

### Purpose

When `/projects/new` enables the persistent user and session data layer, SiteForge emits the same identity-data contract for all five backend profiles:

```text
auth_users
auth_sessions
```

The login, rotation, logout, and revocation runtime documented in [`MANUAL_SESSION_RUNTIME.md`](./MANUAL_SESSION_RUNTIME.md) now consumes this data layer. If route-authentication code is disabled, the generator can still emit schema and migrations only; `siteforge.session.json` then remains `schema-ready / not-wired`.

### `auth_users`

| Field | Meaning |
| --- | --- |
| `id` | Native auto-incrementing database primary key |
| `email` | Normalized unique login email |
| `password_hash` | Non-reversible password-derived value |
| `role` | Role key from the visual role designer |
| `disabled` | Blocks login and session use |
| `created_at` | Creation time |
| `updated_at` | Last modification time |

### `auth_sessions`

| Field | Meaning |
| --- | --- |
| `id` | Native auto-incrementing database primary key |
| `token_hash` | Unique SHA-256 digest of the raw token |
| `user_id` | Reference to `auth_users.id` |
| `expires_at` | Mandatory expiry time |
| `revoked_at` | Explicit revocation time; null means not revoked |
| `last_used_at` | Most recent authentication use |
| `created_at` | Creation time |

Shared constraints:

- Deleting a user cascades to the user's sessions.
- `user_id` and `expires_at` are indexed.
- Email and token digests are unique.
- PostgreSQL uses matching `BIGSERIAL / BIGINT` types; SQLite uses matching `INTEGER` types.

### Five outputs

- Hono + Drizzle: `schema.ts` and `drizzle/0002_auth_identity_sessions.sql`
- NestJS + Prisma: `AuthUser` and `AuthSession` models
- FastAPI + SQLAlchemy: ORM models and Alembic revision `0002`
- Spring Boot + JPA: Flyway migration `V2`
- Gin + GORM: models, AutoMigrate registration, and Goose migration `00002`

### Password and session parameters

The generated contract uses:

```text
PBKDF2-HMAC-SHA256
600,000 iterations
16-byte random salt
32-byte derived key
32-byte random session token
SHA-256 token digest storage
```

Each password record stores its own iteration count and random salt so the work factor can be upgraded later. Raw session tokens are never stored in the database.

### Generated files

- `siteforge.session.json`: machine-readable state, parameters, endpoints, and compatibility behavior
- `SESSION_SECURITY.md`: bilingual runtime guidance inside the generated project
- bootstrap and session configuration variables in `.env.example`

### Security boundary

Real bootstrap passwords must be injected through secret management. Database backups contain password hashes and token digests and must still be encrypted, access-controlled, and covered by retention and deletion policies.

This data layer is not public registration, password recovery, email verification, MFA, OAuth/OIDC, device management, or login-risk controls. Those remain future capabilities.
