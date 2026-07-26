# 手动全栈工程统一错误协议 / Shared Errors for Manual Full-stack Projects

[中文](#中文) · [English](#english)

---

## 中文

### 目标

手动全栈工程的五套后端现在使用同一组对外错误码，避免直接返回数据库、ORM、校验器或框架的原始异常文本：

| HTTP | `error` | 含义 |
| ---: | --- | --- |
| `400` | `VALIDATION_ERROR` | 请求体、路径参数或查询参数不合法 |
| `404` | `NOT_FOUND` | 目标记录不存在 |
| `409` | `CONSTRAINT_CONFLICT` | 唯一约束、外键约束或受限删除冲突 |
| `500` | `INTERNAL_ERROR` | 未归类的服务端错误 |

认证阶段的 `UNAUTHORIZED`、`FORBIDDEN` 和 `AUTH_NOT_CONFIGURED` 保持不变，并与上述错误共用 OpenAPI `ErrorResponse` Schema。

### 五套后端实现

- Hono：全局 `app.onError`，区分 Zod 校验、SQLite/PostgreSQL 约束和内部错误。
- NestJS：全局 `ApiErrorFilter`，映射 `HttpException` 与 Prisma `P2002`、`P2003`、`P2014`。
- FastAPI：全局处理 `RequestValidationError`、SQLAlchemy `IntegrityError` 和未归类异常。
- Spring Boot：`@RestControllerAdvice` 映射参数校验、`DataIntegrityViolationException`、404 和内部错误。
- Gin：绑定失败返回 `VALIDATION_ERROR`，数据库错误通过统一 Helper 映射，不再把 `err.Error()` 放入响应。

### 信息泄露边界

公开响应只包含稳定错误码，不包含：

- SQL 语句或数据库驱动文本
- 表名、列名、索引名或约束名
- 堆栈信息
- 用户提交的原始值
- Secret、Token 或连接字符串

未归类异常只记录异常类型，不记录完整异常消息。该规则降低日志和 API 响应泄露敏感数据的风险，但不能替代生产日志脱敏、错误追踪权限和数据库监控。

### OpenAPI

`openapi.yaml` 升级到 `0.3.0`，新增 `ErrorResponse`，并为创建、修改和删除接口声明 `400`、`404` 与 `409` 响应。认证生成器随后继续添加 Bearer Security Scheme 和 `/api/auth/me`。

### 当前边界

当前实现主要统一校验、唯一约束和外键冲突。它尚未提供：

- 每个字段的本地化校验详情
- 数据库无响应、超时、死锁和事务重试的独立错误码
- 乐观锁或 revision 冲突
- 请求级追踪 ID 和集中式错误上报
- 五套生成工程的真实运行时集成矩阵

在隔离 Runner 可用前，SiteForge 仍只验证确定性生成契约和静态输出，不宣称五套生成工程已经真实安装并运行。

---

## English

### Goal

All five generated backend profiles now expose the same stable error codes instead of returning raw database, ORM, validator, or framework exception messages:

| HTTP | `error` | Meaning |
| ---: | --- | --- |
| `400` | `VALIDATION_ERROR` | Invalid body, path parameter, or query parameter |
| `404` | `NOT_FOUND` | The requested record does not exist |
| `409` | `CONSTRAINT_CONFLICT` | Unique, foreign-key, or restricted-delete conflict |
| `500` | `INTERNAL_ERROR` | Unclassified server failure |

The authentication errors `UNAUTHORIZED`, `FORBIDDEN`, and `AUTH_NOT_CONFIGURED` remain unchanged and share the same OpenAPI `ErrorResponse` schema.

### Five backend implementations

- Hono uses global `app.onError` handling for Zod validation, SQLite/PostgreSQL constraints, and internal errors.
- NestJS installs a global `ApiErrorFilter` for `HttpException` and Prisma `P2002`, `P2003`, and `P2014` errors.
- FastAPI registers handlers for `RequestValidationError`, SQLAlchemy `IntegrityError`, and unclassified exceptions.
- Spring Boot uses `@RestControllerAdvice` for argument validation, `DataIntegrityViolationException`, 404 responses, and internal errors.
- Gin maps binding failures to `VALIDATION_ERROR` and routes database failures through one helper instead of placing `err.Error()` in API responses.

### Information-disclosure boundary

Public responses contain only stable codes. They do not expose:

- SQL statements or driver messages
- table, column, index, or constraint names
- stack traces
- submitted values
- secrets, tokens, or connection strings

Unclassified failures log the exception type only, not the complete exception message. This reduces accidental disclosure but does not replace production log redaction, restricted error-tracking access, or database monitoring.

### OpenAPI

`openapi.yaml` advances to version `0.3.0`, adds `ErrorResponse`, and documents `400`, `404`, and `409` responses for create, update, and delete operations. The authorization generator then continues to add the bearer security scheme and `/api/auth/me`.

### Current boundary

The current implementation standardizes validation, uniqueness, and foreign-key conflicts. It does not yet provide:

- localized field-level validation details
- dedicated codes for database unavailability, timeouts, deadlocks, or transaction retries
- optimistic-lock or revision conflicts
- request-level trace IDs and centralized error reporting
- a real runtime integration matrix for all five generated stacks

Until an isolated runner exists, SiteForge validates deterministic generation contracts and static output only; it does not claim that all five generated repositories have been installed and executed.
