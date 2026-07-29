# Session 登录保护、审计与清理 / Session Login Protection, Audit, and Cleanup

[中文](#中文) · [English](#english)

---

## 中文

### 定位

持久化 Session 运行时现在同时生成登录失败保护、隐私保护审计和保留数据清理。该能力适用于 Hono、NestJS、FastAPI、Spring Boot 和 Gin，并与现有 `AUTH_IDENTITIES_JSON` 静态 Bearer Token 回退兼容。

### 默认策略

```text
失败窗口：900 秒
最大失败次数：5
锁定时间：900 秒
审计保留：30 天
过期／撤销 Session 保留：7 天
```

可通过以下环境变量覆盖：

```text
AUTH_AUDIT_HASH_KEY
AUTH_LOGIN_WINDOW_SECONDS
AUTH_MAX_LOGIN_ATTEMPTS
AUTH_LOGIN_LOCKOUT_SECONDS
AUTH_AUDIT_RETENTION_DAYS
AUTH_SESSION_RETENTION_DAYS
AUTH_TRUST_PROXY
```

### 限流模型

限流状态保存在当前 API 进程内，同时使用两个可能的键：

- 规范化邮箱的 HMAC-SHA256 摘要
- 可信客户端网络地址的 HMAC-SHA256 摘要

`AUTH_TRUST_PROXY` 默认为 `false`。只有部署在会覆盖 `X-Forwarded-For` 的可信反向代理后面时才应设为 `true`。否则服务端只使用直接连接地址，Hono 在无法取得直接地址时只启用主体维度。

超过限制时返回：

```json
{
  "error": "LOGIN_RATE_LIMITED",
  "retryAfterSeconds": 900
}
```

支持的后端会同时返回 `Retry-After` Header。

### 隐私保护审计

五套后端统一增加 `auth_login_events`：

| 字段 | 含义 |
| --- | --- |
| `id` | 自增主键 |
| `principal_hash` | 规范化邮箱的 HMAC-SHA256 摘要 |
| `network_hash` | 可选网络地址摘要；没有可信地址时为空字符串 |
| `outcome` | `success`、`failure` 或 `rate_limited` |
| `created_at` | 事件时间 |

审计表和结构化日志禁止包含：

- 原始邮箱
- 原始 IP 地址
- 密码或密码哈希
- Session Token 或 Token 摘要
- 请求 Body

`AUTH_AUDIT_HASH_KEY` 应使用至少 32 字节随机 Secret。若未配置或仍为占位值，生成运行时会创建仅在当前进程有效的随机 Key，并输出降级警告；限流仍可用，但重启后摘要无法关联。

### 清理

成功密码登录会以最多每小时一次的频率尝试清理：

- 超过审计保留期的 `auth_login_events`
- 超过 Session 保留期的已过期 Session
- 超过 Session 保留期的已撤销 Session

完整权限管理员可以显式调用：

```text
POST /api/auth/maintenance/cleanup
```

普通角色返回 `403 FORBIDDEN`。

### 多实例边界

数据库审计在多实例间共享，但本阶段限流锁定状态仍是单进程内存状态。水平扩展部署不能把该基线视为严格的全局登录限制；后续需要 Redis 或数据库原子计数与锁定时间。

---

## English

### Purpose

The persistent-session runtime now also generates failed-login protection, privacy-preserving audit events, and retained-data cleanup for Hono, NestJS, FastAPI, Spring Boot, and Gin. It remains compatible with the existing `AUTH_IDENTITIES_JSON` static bearer-token fallback.

### Default policy

```text
Failure window: 900 seconds
Maximum failures: 5
Lockout: 900 seconds
Audit retention: 30 days
Expired/revoked session retention: 7 days
```

The policy can be overridden with:

```text
AUTH_AUDIT_HASH_KEY
AUTH_LOGIN_WINDOW_SECONDS
AUTH_MAX_LOGIN_ATTEMPTS
AUTH_LOGIN_LOCKOUT_SECONDS
AUTH_AUDIT_RETENTION_DAYS
AUTH_SESSION_RETENTION_DAYS
AUTH_TRUST_PROXY
```

### Rate-limit model

Rate-limit state is kept in the current API process and uses up to two keys:

- an HMAC-SHA256 digest of the normalized email address
- an HMAC-SHA256 digest of a trusted client network address

`AUTH_TRUST_PROXY` defaults to `false`. Set it to `true` only behind a trusted reverse proxy that overwrites `X-Forwarded-For`. Otherwise the server uses the direct peer address; Hono falls back to principal-only limiting when the adapter cannot expose that address.

A limited request returns:

```json
{
  "error": "LOGIN_RATE_LIMITED",
  "retryAfterSeconds": 900
}
```

Supported backends also send a `Retry-After` header.

### Privacy-preserving audit

Every backend adds `auth_login_events`:

| Field | Meaning |
| --- | --- |
| `id` | Auto-incrementing primary key |
| `principal_hash` | HMAC-SHA256 digest of the normalized email |
| `network_hash` | Optional network digest; empty when no trusted address is available |
| `outcome` | `success`, `failure`, or `rate_limited` |
| `created_at` | Event time |

The audit table and structured logs must not contain:

- raw email addresses
- raw IP addresses
- passwords or password hashes
- session tokens or token digests
- request bodies

`AUTH_AUDIT_HASH_KEY` should be at least 32 random bytes. If it is missing or remains a placeholder, the generated runtime creates an ephemeral process key and logs a degraded-mode warning. Rate limiting still works, but hashes cannot be correlated after a restart.

### Cleanup

A successful password login attempts cleanup at most once per hour:

- `auth_login_events` older than the audit-retention period
- expired sessions older than the session-retention period
- revoked sessions older than the session-retention period

A full-access administrator can explicitly call:

```text
POST /api/auth/maintenance/cleanup
```

Other roles receive `403 FORBIDDEN`.

### Multi-instance boundary

Database audit events are shared across instances, but lockout state remains process-local in this phase. A horizontally scaled deployment must not treat the baseline as a strict global login limit. A later phase requires Redis or database-backed atomic counters and lock timestamps.
