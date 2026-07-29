# 手动全栈工程认证与权限 / Manual Full-stack Authentication and Authorization

[中文](#中文) · [English](#english)

---

## 中文

### 范围

SiteForge 手动全栈工程现在为五套后端确定性生成同一套 **Opaque Bearer Token + 资源级 RBAC** 基线：

- Hono + Drizzle
- NestJS + Prisma
- FastAPI + SQLAlchemy
- Spring Boot + JPA
- Gin + GORM

该能力不调用 AI。它为当前 CRUD、外键、分页、搜索和排序 API 增加认证入口与路由权限，但不会把生成工程提交、部署或在 SiteForge 内执行。

### 运行时开关

生成工程中的认证代码默认存在，但运行时默认关闭，以避免破坏原有零配置开发路径：

```text
AUTH_ENABLED=false
AUTH_IDENTITIES_JSON=[{"token":"...","userId":"admin","email":"admin@example.com","role":"admin"}]
```

启用时，应把变量直接传给 API 进程或部署平台 Secret。例如：

```bash
AUTH_ENABLED=true \
AUTH_IDENTITIES_JSON='[{"token":"replace-with-a-random-secret-at-least-32-characters","userId":"admin","email":"admin@example.com","role":"admin"}]' \
pnpm dev
```

`.env.example` 只描述变量格式。当前生成的 Compose 基线不会自动把认证变量传入 API 容器；容器部署必须在 `services.api.environment`、额外 Compose 覆盖文件或平台 Secret 中显式注入。

### 身份与默认角色

每个静态身份包含：

```json
{
  "token": "secret",
  "userId": "admin",
  "email": "admin@example.com",
  "role": "admin"
}
```

Token 至少 16 个字符；正式环境应使用至少 32 个随机字符。未知角色的身份不会进入有效身份集合。

默认角色：

| 角色 | 权限 |
| --- | --- |
| `admin` | 所有资源的 `list`、`read`、`create`、`update`、`delete` |
| `editor` | 所有资源的 `list`、`read`、`create`、`update` |
| `viewer` | 所有资源的 `list`、`read` |

共享层会校验角色标识、重复角色、未知实体、未知权限动作和管理员锁死风险。启用访问控制时，至少需要一个角色拥有全部资源的完整权限。

### 路由动作映射

每个实体的 API 方法统一映射为：

| 请求 | 动作 |
| --- | --- |
| `GET /api/resources` | `list` |
| `GET /api/resources/:id` | `read` |
| `POST /api/resources` | `create` |
| `PATCH /api/resources/:id` | `update` |
| `DELETE /api/resources/:id` | `delete` |

`/api/health` 始终公开。`/api/auth/me` 在关闭认证时返回 `{ enabled: false, identity: null }`；启用后要求有效 Token，并只返回 `userId`、`email` 和 `role`，不会回传 Token。

### 统一错误

| 状态 | 错误码 | 含义 |
| ---: | --- | --- |
| `503` | `AUTH_NOT_CONFIGURED` | 已启用认证，但没有合法身份配置 |
| `401` | `UNAUTHORIZED` | Token 缺失或无效 |
| `403` | `FORBIDDEN` | 身份有效，但角色没有当前资源动作权限 |

该错误协议只覆盖认证与授权。数据库唯一约束、外键冲突和其他业务异常仍需要后续统一错误处理中间件。

### Token 比较与前端

五套后端都会先把候选 Token 计算为固定长度 SHA-256 摘要，再使用语言原生的常量时间原语比较：

- Node.js：`timingSafeEqual`
- Python：`hmac.compare_digest`
- Java：`MessageDigest.isEqual`
- Go：`subtle.ConstantTimeCompare`

生成的 Vue 管理端新增认证面板，把 Token 保存在当前标签页的 `sessionStorage`，并通过统一 `authFetch` 为 CRUD 和关系选择请求添加 `Authorization: Bearer ...`。关闭标签页后 Token 不再保留。

### 生成产物

除各后端认证中间件／Guard／Filter 外，工程还会生成：

- `siteforge.auth.json`：角色、资源、动作、环境变量和公开路由的机器可读协议
- `AUTHORIZATION.md`：生成工程内的中英双语启用与安全说明
- `apps/web/src/auth.ts`
- `apps/web/src/AuthPanel.vue`
- OpenAPI `bearerAuth` Security Scheme 与 `/api/auth/me`

`siteforge.json` 暂时继续使用 schema v2；认证策略通过独立 `siteforge.auth.json` 演进，避免在本阶段无兼容迁移地修改主工程清单。

### 当前边界

本阶段是路由认证与角色权限基础，不包含：

- 密码注册、登录或密码找回
- 持久化用户表和角色管理 API
- 服务端 Session、刷新 Token、撤销和轮换
- 邮箱验证、多因素认证或 OAuth/OIDC
- 字段级和记录级权限
- 可视化自定义角色设计器
- 五套生成工程在隔离 Runner 中的真实安装、迁移和启动矩阵

后续阶段应优先补密码／Session 安全、持久化用户与角色、统一约束错误、Token 撤销和真实多栈运行验证。

---

## English

### Scope

The SiteForge manual full-stack generator now deterministically emits the same **opaque bearer-token plus resource-level RBAC** baseline for all five backend profiles:

- Hono + Drizzle
- NestJS + Prisma
- FastAPI + SQLAlchemy
- Spring Boot + JPA
- Gin + GORM

This capability does not call AI. It adds an authentication endpoint and route permissions to the existing CRUD, foreign-key, pagination, search, and sorting APIs, but SiteForge still does not commit, deploy, or execute the generated project.

### Runtime switch

Authentication code is present in the generated project, but enforcement is disabled by default so the existing zero-configuration development path remains compatible:

```text
AUTH_ENABLED=false
AUTH_IDENTITIES_JSON=[{"token":"...","userId":"admin","email":"admin@example.com","role":"admin"}]
```

When enabling it, pass the variables directly to the API process or deployment-platform secret store. For example:

```bash
AUTH_ENABLED=true \
AUTH_IDENTITIES_JSON='[{"token":"replace-with-a-random-secret-at-least-32-characters","userId":"admin","email":"admin@example.com","role":"admin"}]' \
pnpm dev
```

`.env.example` documents the variable shape only. The current generated Compose baseline does not automatically forward the authentication variables to the API container. Container deployments must inject them explicitly through `services.api.environment`, an additional Compose override, or the platform secret store.

### Identities and default roles

Each static identity contains:

```json
{
  "token": "secret",
  "userId": "admin",
  "email": "admin@example.com",
  "role": "admin"
}
```

Tokens must contain at least 16 characters; production deployments should use at least 32 random characters. Identities with unknown roles are excluded from the valid identity set.

Default roles:

| Role | Permissions |
| --- | --- |
| `admin` | `list`, `read`, `create`, `update`, and `delete` for every resource |
| `editor` | `list`, `read`, `create`, and `update` for every resource |
| `viewer` | `list` and `read` for every resource |

The shared layer validates role keys, duplicate roles, unknown entities, unknown actions, and administrator lockout risk. When access control is enabled, at least one role must retain full access to every resource.

### Route-to-action mapping

Each entity API maps methods consistently:

| Request | Action |
| --- | --- |
| `GET /api/resources` | `list` |
| `GET /api/resources/:id` | `read` |
| `POST /api/resources` | `create` |
| `PATCH /api/resources/:id` | `update` |
| `DELETE /api/resources/:id` | `delete` |

`/api/health` always remains public. With authentication disabled, `/api/auth/me` returns `{ enabled: false, identity: null }`. Once enabled, it requires a valid token and returns only `userId`, `email`, and `role`; it never returns the token.

### Shared errors

| Status | Error code | Meaning |
| ---: | --- | --- |
| `503` | `AUTH_NOT_CONFIGURED` | Authentication is enabled but no valid identities are configured |
| `401` | `UNAUTHORIZED` | The token is missing or invalid |
| `403` | `FORBIDDEN` | The identity is valid but its role lacks the required resource action |

This shared protocol covers authentication and authorization only. Database uniqueness failures, foreign-key conflicts, and other business errors still need follow-up shared error middleware.

### Token comparison and frontend

Every backend first reduces candidate tokens to fixed-length SHA-256 digests, then uses the language's native constant-time primitive:

- Node.js: `timingSafeEqual`
- Python: `hmac.compare_digest`
- Java: `MessageDigest.isEqual`
- Go: `subtle.ConstantTimeCompare`

The generated Vue admin adds an authentication panel, stores the token in the current tab's `sessionStorage`, and uses a shared `authFetch` wrapper to attach `Authorization: Bearer ...` to CRUD and relation-selector requests. The token is discarded when the tab is closed.

### Generated artifacts

In addition to each backend's middleware, guard, or filter, the project receives:

- `siteforge.auth.json`: a machine-readable contract for roles, resources, actions, environment variables, and public routes
- `AUTHORIZATION.md`: bilingual activation and security guidance inside the generated project
- `apps/web/src/auth.ts`
- `apps/web/src/AuthPanel.vue`
- an OpenAPI `bearerAuth` security scheme and `/api/auth/me`

`siteforge.json` remains on schema v2 for now. Authentication policy evolves independently through `siteforge.auth.json`, avoiding an incompatible main-manifest migration in this phase.

### Current boundary

This phase is a route-authentication and role-permission foundation. It does not include:

- password registration, login, or recovery
- a persistent user table or role-management API
- server-side sessions, refresh tokens, revocation, or rotation
- email verification, multi-factor authentication, or OAuth/OIDC
- field-level or record-level authorization
- a visual custom-role designer
- real installation, migration, and startup of all five generated stacks in an isolated runner

The next security phase should prioritize password/session security, persistent users and roles, shared constraint-error handling, token revocation, and real multi-stack runtime verification.
