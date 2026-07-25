# 手动全栈工程 / Manual Full-stack Projects

[中文](#中文) · [English](#english)

---

## 中文

### 定位

手动全栈工程向导通过确定性模板生成完整源码，不调用 AI、不需要模型 API Key，也不会在 SiteForge 主服务中执行生成代码。相同输入会产生相同的目录结构和配置，便于测试、审查和问题复现。

入口：

```text
/projects/new
```

数据模型与 CRUD 的详细协议参见 [`MANUAL_CRUD_DESIGNER.md`](./MANUAL_CRUD_DESIGNER.md)。

### 统一前端

第一阶段所有工程统一使用：

- Vue 3
- Vite
- TypeScript
- Vitest
- 独立 `apps/web` 服务

统一前端可以先把后端技术栈、数据库、构建和部署矩阵做稳定，再扩展 React、Nuxt 等前端档案。

### 可选后端

| 档案 | 语言 / Runtime | ORM | 迁移 | SQLite | PostgreSQL |
| --- | --- | --- | --- | --- | --- |
| Hono + Drizzle | TypeScript / Node.js 24 | Drizzle ORM | Drizzle Kit | 是 | 是 |
| NestJS + Prisma | TypeScript / Node.js 24 | Prisma | Prisma Migrate | 是 | 是 |
| FastAPI + SQLAlchemy | Python 3.14 | SQLAlchemy | Alembic | 是 | 是 |
| Spring Boot + JPA | Java 21 | Spring Data JPA | Flyway | 否 | 是 |
| Gin + GORM | Go 1.25 | GORM | Goose | 是 | 是 |

系统只展示已经声明支持的数据库组合。Spring Boot 第一版只开放 PostgreSQL，避免生成缺少稳定 SQLite 驱动和迁移约束的工程。

### 输出内容

生成的 ZIP 至少包含：

```text
apps/web/
apps/api/
.env.example
package.json
pnpm-workspace.yaml
siteforge.json
openapi.yaml
README.md
```

默认还包含：

- 前后端 Dockerfile
- `docker-compose.yml`
- GitHub Actions 基础工作流
- `/api/health` 健康检查
- ORM Schema 或数据模型
- 数据库迁移配置
- 用户配置实体对应的 CRUD API
- Vue 列表、表单、新建、编辑与删除界面
- 中英双语项目 README

### siteforge.json

工程清单 schema v2 记录：

- `projectKind: fullstack-app`
- 前端和后端档案
- 数据库类型
- 数据实体、路由和字段
- Web/API 服务目录和端口
- API 健康检查路径
- 安装、开发、构建、测试和迁移命令

后续隔离 Runner、工程工作区和部署功能都应读取该清单，不能根据文件名猜测启动方式。

### 当前安全边界

- 生成完全在浏览器内完成。
- SiteForge 不安装生成工程的依赖。
- SiteForge 不启动生成的 API。
- SiteForge 不运行数据库迁移。
- ZIP 中只包含 `.env.example`，不会写入真实凭据。
- 隔离 Runner 上线前，不允许平台执行用户生成代码。

### 自动验证

普通 PR CI 会验证：

- 五套后端档案均包含完整的 Runtime、框架、ORM、迁移和命令元数据
- 不兼容的后端与数据库组合会在生成前被拒绝
- 数据模型名称、路由、字段、枚举和规模限制
- 每套档案都能生成 Vue CRUD、API 路由、ORM、迁移、OpenAPI 和工程清单
- Spring 只保留一个 V1 Flyway 资源迁移
- Gin 只导入选定数据库驱动，并生成对应 Goose SQL
- ZIP 选项会正确包含或省略 Docker Compose 与 GitHub Actions 文件
- `/projects/new` 可以配置多个实体，并在错误模型下禁止下载
- 手动向导在桌面和手机端无严重 Axe 问题、运行时错误或横向溢出

当前门禁验证 SiteForge 生成器和输出文件契约；在隔离 Runner 完成前，不会冒充已经安装、构建或执行每个生成的 Java、Python、Go 和 Node.js 工程。

### 当前限制

当前已经完成可视化数据模型和基础 CRUD，但还没有完成：

- 实体关系与外键
- 服务端分页、搜索和排序
- 认证与权限模块
- 云端工程文件版本存储
- 隔离构建和在线预览
- 自动执行后端各生态的完整 CI

这些能力会继续在 `Feature-dev-v0.1.0` 和长期 Draft PR #44 中开发，不扩展 AI 生成。

---

## English

### Purpose

The manual full-stack wizard generates complete source repositories from deterministic templates. It does not call AI, require a model API key, or execute generated code inside the SiteForge server. The same input produces the same structure and configuration, making the output testable, reviewable, and reproducible.

Entry point:

```text
/projects/new
```

See [`MANUAL_CRUD_DESIGNER.md`](./MANUAL_CRUD_DESIGNER.md) for the data-model and CRUD protocol.

### Shared frontend

The first phase standardizes every project on:

- Vue 3
- Vite
- TypeScript
- Vitest
- A dedicated `apps/web` service

A shared frontend lets the project stabilize backend, database, build, and deployment matrices before introducing React, Nuxt, or other frontend profiles.

### Backend choices

| Profile | Language / Runtime | ORM | Migrations | SQLite | PostgreSQL |
| --- | --- | --- | --- | --- | --- |
| Hono + Drizzle | TypeScript / Node.js 24 | Drizzle ORM | Drizzle Kit | Yes | Yes |
| NestJS + Prisma | TypeScript / Node.js 24 | Prisma | Prisma Migrate | Yes | Yes |
| FastAPI + SQLAlchemy | Python 3.14 | SQLAlchemy | Alembic | Yes | Yes |
| Spring Boot + JPA | Java 21 | Spring Data JPA | Flyway | No | Yes |
| Gin + GORM | Go 1.25 | GORM | Goose | Yes | Yes |

The wizard only exposes combinations explicitly supported by a profile. Spring Boot initially supports PostgreSQL only, avoiding a generated configuration that lacks a stable SQLite driver and migration contract.

### Generated output

Every ZIP contains at least:

```text
apps/web/
apps/api/
.env.example
package.json
pnpm-workspace.yaml
siteforge.json
openapi.yaml
README.md
```

The default output also includes frontend and backend Dockerfiles, `docker-compose.yml`, a baseline GitHub Actions workflow, `/api/health`, ORM and migration files, CRUD APIs for configured entities, a Vue list/form/create/update/delete interface, and a bilingual README.

### siteforge.json

The schema-v2 engineering manifest records the project kind, frontend and backend profiles, database, entities and fields, service directories and ports, health-check path, and install/development/build/test/migration commands.

Future isolated runners, engineering workspaces, and deployment features must read this manifest instead of guessing commands from file names.

### Current safety boundary

Generation happens entirely in the browser. SiteForge does not install generated dependencies, start generated APIs, execute database migrations, access user databases, or write real credentials. The platform must not execute generated code until an isolated runner exists.

### Automated validation

Standard pull-request CI verifies backend profile metadata, rejected database combinations, data-model identifiers and limits, Vue CRUD and backend-specific output for all profiles, single-version Spring migrations, selected Gin drivers and Goose SQL, optional ZIP files, multi-entity browser configuration, invalid-model download prevention, Axe accessibility, runtime errors, and mobile overflow.

These gates validate the generator and file contracts. They do not claim that every generated Java, Python, Go, and Node.js repository has been installed and executed in an isolated environment.

### Current limitations

Visual data models and baseline CRUD are complete. Entity relationships and foreign keys, server-side pagination/search/sorting, authentication and authorization, cloud engineering-file versioning, isolated builds and online previews, and full backend-ecosystem execution are not yet complete.

These capabilities will continue on `Feature-dev-v0.1.0` and long-lived Draft PR #44 without expanding AI generation.
