# v0.1.0 RC 完整性审计 / v0.1.0 RC Integrity Audit

[中文](#中文) · [English](#english)

## 中文

### 目标

`pnpm rc:audit` 对手动全栈生成链路执行发布候选级静态审计。该命令不启动生成工程，也不需要 Docker、数据库或外部网络，因此适合在完整运行矩阵之前快速发现生成器组合错误。

### 覆盖范围

审计固定生成所有受支持组合：

- Hono + Drizzle：SQLite、PostgreSQL
- NestJS + Prisma：SQLite、PostgreSQL
- FastAPI + SQLAlchemy：SQLite、PostgreSQL
- Spring Boot + JPA：PostgreSQL
- Gin + GORM：SQLite、PostgreSQL

每个组合使用同一份复杂模型，覆盖敏感字段、owner/team 关系、持久化 Session、字段与记录权限、共享登录限制、设备管理、密码生命周期、高级关系、高级字段、复合索引和乐观锁。

### 阻断条件

以下任一问题会让命令以非零状态退出：

- 相同输入连续生成的完整文件摘要不同
- 重复文件路径
- 缺少核心 `siteforge.*.json` 或 OpenAPI 协议
- 生成 JSON 无法解析
- 同一技术栈出现重复迁移版本
- 同一文件出现完全重复的 Import
- OpenAPI 重复路径或重复 HTTP 操作
- 核心生成文档缺少中文或英文完整章节

### 边界

该审计不能替代依赖安装、ORM Schema 校验、真实 Migration、编译、浏览器测试或五套服务启动。RC 阶段仍必须建立 Golden Project 并执行真实运行矩阵。

## English

### Goal

`pnpm rc:audit` performs release-candidate static integrity checks over the manual full-stack generation pipeline. It does not start generated projects and requires no Docker, database, or external network access, so it catches composition failures before the full runtime matrix.

### Coverage

The audit deterministically generates every supported combination:

- Hono + Drizzle: SQLite and PostgreSQL
- NestJS + Prisma: SQLite and PostgreSQL
- FastAPI + SQLAlchemy: SQLite and PostgreSQL
- Spring Boot + JPA: PostgreSQL
- Gin + GORM: SQLite and PostgreSQL

Every combination uses the same complex fixture covering sensitive fields, owner/team relations, persistent sessions, field and record authorization, distributed login limits, device management, password lifecycle, advanced relations, advanced fields, composite indexes, and optimistic locking.

### Blocking conditions

The command exits non-zero when it finds any of the following:

- different complete-file fingerprints for repeated generation with the same input
- duplicate generated paths
- missing core `siteforge.*.json` or OpenAPI contracts
- invalid generated JSON
- duplicate migration versions in one generated stack
- exact duplicate imports within a generated file
- duplicate OpenAPI paths or HTTP operations
- missing full Chinese or English sections in core generated documentation

### Boundary

This audit does not replace dependency installation, ORM schema validation, real migrations, compilation, browser tests, or starting all five generated services. The RC phase must still establish Golden Projects and execute the real runtime matrix.
