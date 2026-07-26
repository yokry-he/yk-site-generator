# 持久化 Session 运行时 / Persistent Session Runtime

[中文](#中文) · [English](#english)

---

## 中文

### 定位

SiteForge 手动全栈工程的持久化用户与 Session 数据层现在可以直接生成运行时认证闭环。该阶段建立在 `auth_users` 和 `auth_sessions` 之上，为 Hono、NestJS、FastAPI、Spring Boot 与 Gin 输出一致的端点、密码协议和 Session 生命周期。

现有 `AUTH_IDENTITIES_JSON` 静态 Bearer Token 继续作为兼容回退，不需要在启用数据库 Session 的同一时刻迁移所有自动化客户端。

### 端点

```text
POST /api/auth/bootstrap
POST /api/auth/login
GET  /api/auth/me
POST /api/auth/logout
POST /api/auth/rotate
POST /api/auth/revoke-all
```

- `bootstrap` 只在用户表为空时，根据服务端 Secret 创建首个完整权限角色用户。
- `login` 使用邮箱和密码创建数据库 Session，并只返回一次原始 Token。
- `me` 返回公开身份、认证来源以及数据库 Session 的到期时间。
- `logout` 撤销当前数据库 Session。
- `rotate` 创建替换 Token，并在同一事务中撤销旧 Session。
- `revoke-all` 撤销当前用户的全部数据库 Session。

`bootstrap` 和 `login` 是公开端点；其他端点需要有效身份。资源路由继续使用设计器中的实体动作矩阵。

### 密码存储

所有后端使用同一格式：

```text
pbkdf2_sha256$600000$saltHex$hashHex
```

参数：

- PBKDF2-HMAC-SHA256
- 600,000 次迭代
- 16 字节密码学随机盐
- 32 字节派生密钥
- 常量时间哈希比较

邮箱或密码错误统一返回 `INVALID_CREDENTIALS`，不会暴露账号是否存在或是否被禁用。

### Session Token

- 每个 Token 使用 32 字节密码学随机数，再编码为 URL-safe 字符串。
- 数据库只保存 SHA-256 摘要。
- 原始 Token 只在登录和轮换响应中出现一次。
- 已过期、已撤销或属于禁用用户的 Session 不通过认证。
- Session 请求更新 `last_used_at`。
- 超过单用户活动 Session 上限时，撤销最旧的活动 Session。

### 管理员引导

引导凭据来自：

```text
AUTH_BOOTSTRAP_EMAIL
AUTH_BOOTSTRAP_PASSWORD
```

密码长度不足、仍是示例占位值或邮箱无效时返回 `BOOTSTRAP_NOT_CONFIGURED`。数据库已经存在用户时返回 `BOOTSTRAP_ALREADY_COMPLETED`。由于邮箱有唯一约束，并发引导请求不会创建两个相同的首个管理员。

完成引导后应立即从部署平台移除 `AUTH_BOOTSTRAP_PASSWORD`。

### 五套实现

- Hono：Drizzle 查询、Node `crypto.pbkdf2Sync`、事务 Session 轮换。
- NestJS：Prisma `AuthService`、异步全局 Guard 和事务 Session 管理。
- FastAPI：SQLAlchemy Session、中间件身份解析和独立认证 Router。
- Spring Boot：`JdbcTemplate`、`@Transactional`、Servlet Filter 和 Controller。
- Gin：GORM Transaction、内置 PBKDF2-HMAC-SHA256 实现和统一 Middleware。

### 生成的前端

Vue 管理端认证面板支持：

- 邮箱密码登录
- 首个管理员初始化
- 兼容静态 Bearer Token
- Token 轮换
- 当前 Session 退出
- 撤销当前用户全部 Session

Token 仍只保存在当前标签页的 `sessionStorage`。

### 当前边界

登录限流、隐私保护审计和保留数据清理由 [`MANUAL_SESSION_PROTECTION.md`](./MANUAL_SESSION_PROTECTION.md) 说明。本阶段仍不包含公开注册、密码找回、邮箱验证、MFA、OAuth/OIDC、设备管理页面、全局多实例限流或独立调度器。额度恢复后还需要执行五套真实工程的安装、迁移、启动和端点矩阵。

---

## English

### Purpose

The persistent user and session data layer in SiteForge manual full-stack projects can now generate a complete runtime authentication loop. The phase builds on `auth_users` and `auth_sessions` and emits consistent endpoints, password storage, and session lifecycle behavior for Hono, NestJS, FastAPI, Spring Boot, and Gin.

The existing `AUTH_IDENTITIES_JSON` static bearer-token flow remains a compatibility fallback, so existing automation clients do not need to migrate at the same moment database sessions are enabled.

### Endpoints

```text
POST /api/auth/bootstrap
POST /api/auth/login
GET  /api/auth/me
POST /api/auth/logout
POST /api/auth/rotate
POST /api/auth/revoke-all
```

- `bootstrap` creates the first full-access user from server-side secrets only while the user table is empty.
- `login` verifies email and password, creates a database session, and returns the raw token once.
- `me` returns the public identity, authentication source, and database-session expiry.
- `logout` revokes the current database session.
- `rotate` creates a replacement token and revokes the old session in the same transaction.
- `revoke-all` revokes every database session for the current user.

`bootstrap` and `login` are public. The remaining endpoints require a valid identity. Resource routes continue to use the entity-action matrix from the role designer.

### Password storage

Every backend uses the same format:

```text
pbkdf2_sha256$600000$saltHex$hashHex
```

Parameters:

- PBKDF2-HMAC-SHA256
- 600,000 iterations
- a 16-byte cryptographic random salt
- a 32-byte derived key
- constant-time hash comparison

Invalid email or password combinations return `INVALID_CREDENTIALS` without revealing whether the account exists or is disabled.

### Session tokens

- Each token begins with 32 bytes of cryptographic randomness and is encoded as a URL-safe string.
- Only the SHA-256 digest is stored in the database.
- Raw tokens appear only once in login and rotation responses.
- Expired, revoked, or disabled-user sessions do not authenticate.
- Session requests update `last_used_at`.
- When the per-user active-session limit is exceeded, the oldest active sessions are revoked.

### Administrator bootstrap

Bootstrap credentials come from:

```text
AUTH_BOOTSTRAP_EMAIL
AUTH_BOOTSTRAP_PASSWORD
```

A short or placeholder password, or an invalid email, returns `BOOTSTRAP_NOT_CONFIGURED`. An existing user returns `BOOTSTRAP_ALREADY_COMPLETED`. The unique email constraint prevents concurrent bootstrap requests from creating duplicate first administrators with the configured email.

Remove `AUTH_BOOTSTRAP_PASSWORD` from the deployment platform immediately after bootstrap completes.

### Five implementations

- Hono: Drizzle queries, Node `crypto.pbkdf2Sync`, and transactional session rotation.
- NestJS: a Prisma-backed `AuthService`, asynchronous global guard, and transactional session management.
- FastAPI: SQLAlchemy sessions, middleware identity resolution, and a dedicated authentication router.
- Spring Boot: `JdbcTemplate`, `@Transactional`, a servlet filter, and a controller.
- Gin: GORM transactions, an embedded PBKDF2-HMAC-SHA256 implementation, and shared middleware.

### Generated frontend

The generated Vue authentication panel supports:

- email/password login
- first-administrator bootstrap
- compatible static bearer tokens
- token rotation
- current-session logout
- revoking all sessions for the current user

The token remains limited to the current tab's `sessionStorage`.

### Current boundary

Login throttling, privacy-preserving audit, and retained-data cleanup are documented in [`MANUAL_SESSION_PROTECTION.md`](./MANUAL_SESSION_PROTECTION.md). This phase still excludes public registration, password recovery, email verification, MFA, OAuth/OIDC, device management, globally shared multi-instance lockouts, and a standalone scheduler. After the Actions quota resets, all five generated projects still require real installation, migration, startup, and endpoint-matrix validation.
