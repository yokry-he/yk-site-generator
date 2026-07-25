# 手动全栈工程 / Manual Full-stack Projects

[中文](#中文) · [English](#english)

---

## 中文

### 定位

手动全栈工程向导通过确定性模板生成完整源码，不调用 AI、不需要模型 API Key，也不会在 SiteForge 主服务中执行生成代码。相同输入会产生相同的目录结构、数据库协议和 API 契约，便于测试、审查和问题复现。

入口：

```text
/projects/new
```

数据模型、关系、分页和 CRUD 的详细协议参见 [`MANUAL_CRUD_DESIGNER.md`](./MANUAL_CRUD_DESIGNER.md)。

### 统一前端

当前所有工程统一使用 Vue 3、Vite、TypeScript、Vitest 和独立 `apps/web` 服务。统一前端使后端、数据库、查询和部署矩阵先达到稳定，再扩展 React、Nuxt 等前端档案。

### 可选后端

| 档案 | 语言 / Runtime | ORM | 迁移 | SQLite | PostgreSQL |
| --- | --- | --- | --- | --- | --- |
| Hono + Drizzle | TypeScript / Node.js 24 | Drizzle ORM | Drizzle Kit | 是 | 是 |
| NestJS + Prisma | TypeScript / Node.js 24 | Prisma | Prisma Migrate | 是 | 是 |
| FastAPI + SQLAlchemy | Python 3.14 | SQLAlchemy | Alembic | 是 | 是 |
| Spring Boot + JPA | Java 21 | Spring Data JPA | Flyway | 否 | 是 |
| Gin + GORM | Go 1.25 | GORM | Goose | 是 | 是 |

系统只展示档案明确支持的数据库组合。Spring Boot 第一版只开放 PostgreSQL。

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
- `/api/health`
- ORM Schema、实体和数据库迁移
- 用户配置实体对应的 CRUD API
- 外键与 `restrict`、`cascade`、`set-null` 删除策略
- 服务端分页、字段白名单搜索和排序
- Vue 列表、分页、搜索、排序、关系选择、新建、编辑与删除界面
- 中英双语项目 README

### siteforge.json

工程清单 schema v2 记录：

- `projectKind: fullstack-app`
- 前端和后端档案
- 数据库类型
- 数据实体、字段、属于关系和删除策略
- 列表页大小、默认排序字段和方向
- Web/API 服务目录和端口
- API 健康检查路径
- 安装、开发、构建、测试和迁移命令

后续隔离 Runner、工程工作区和部署功能都应读取该清单，不能根据文件名猜测启动方式。

### 当前安全边界

- 生成完全在浏览器内完成
- SiteForge 不安装生成工程的依赖
- 不启动生成的 API
- 不运行数据库迁移
- 不访问用户数据库
- ZIP 只包含 `.env.example`
- 隔离 Runner 上线前，不允许平台执行用户生成代码

### 自动验证

标准 PR CI 会验证：

- 五套后端档案的 Runtime、框架、ORM、迁移和命令元数据
- 不兼容的后端与数据库组合会在生成前被拒绝
- 数据模型、关系目标、删除策略、搜索字段和排序白名单
- 五套档案均生成 Vue 管理端、原生 CRUD、外键、迁移、OpenAPI 和工程清单
- Spring 只保留一个 V1 Flyway 资源迁移
- Gin 只导入所选数据库驱动并生成匹配的 Goose SQL
- ZIP 可选文件和路径去重
- 浏览器可以配置多个实体、外键、分页和排序
- 错误模型会阻止下载
- 桌面和手机端 Axe、运行时错误、横向溢出与视觉回归

这些门禁验证 SiteForge 生成器和输出文件契约。在隔离 Runner 完成前，不会声称已经实际安装、构建或执行每个生成的 Java、Python、Go 和 Node.js 工程。

### 当前限制

当前已经完成可视化数据模型、属于关系、外键、删除策略、分页、搜索、排序和基础 CRUD。仍未完成：

- 一对一、多对多、自引用与循环关系
- 远程关系搜索和超大关系数据集选择
- 复合索引和复合唯一约束
- 认证、角色与路由权限
- 云端工程文件版本存储
- 隔离构建和在线预览
- 自动执行五套生成工程的真实构建矩阵

这些能力继续在 `Feature-dev-v0.1.0` 和长期 Draft PR #44 中开发，不扩展 AI 生成。

---

## English

### Purpose

The manual full-stack wizard generates complete source repositories from deterministic templates. It does not call AI, require a model API key, or execute generated code inside SiteForge. Identical inputs produce identical structure, database rules, and API contracts.

Entry point:

```text
/projects/new
```

See [`MANUAL_CRUD_DESIGNER.md`](./MANUAL_CRUD_DESIGNER.md) for the data-model, relation, pagination, and CRUD protocol.

### Shared frontend

All current projects use Vue 3, Vite, TypeScript, Vitest, and a dedicated `apps/web` service. A shared frontend lets the backend, database, query, and deployment matrices stabilize before additional frontend profiles are introduced.

### Backend choices

| Profile | Language / Runtime | ORM | Migrations | SQLite | PostgreSQL |
| --- | --- | --- | --- | --- | --- |
| Hono + Drizzle | TypeScript / Node.js 24 | Drizzle ORM | Drizzle Kit | Yes | Yes |
| NestJS + Prisma | TypeScript / Node.js 24 | Prisma | Prisma Migrate | Yes | Yes |
| FastAPI + SQLAlchemy | Python 3.14 | SQLAlchemy | Alembic | Yes | Yes |
| Spring Boot + JPA | Java 21 | Spring Data JPA | Flyway | No | Yes |
| Gin + GORM | Go 1.25 | GORM | Goose | Yes | Yes |

Only combinations declared by a profile are exposed. Spring Boot initially supports PostgreSQL only.

### Generated output

Every ZIP contains `apps/web`, `apps/api`, `.env.example`, root workspace configuration, `siteforge.json`, `openapi.yaml`, and a bilingual README. The default output additionally includes Dockerfiles, Compose, a baseline GitHub Actions workflow, health checks, ORM models, migrations, CRUD APIs, foreign keys and referential actions, allowlisted server-side pagination/search/sorting, and a Vue administration interface with relation selects.

### siteforge.json

The schema-v2 engineering manifest records project and stack profiles, database, entities, fields, belongs-to relations, referential actions, list page size and default sorting, service locations and ports, health checks, and install/development/build/test/migration commands.

Future runners, engineering workspaces, and deployments must read this manifest instead of guessing commands from file names.

### Current safety boundary

Generation happens entirely in the browser. SiteForge does not install generated dependencies, start APIs, execute migrations, access user databases, or write real credentials. Generated code must not be executed until an isolated runner exists.

### Automated validation

Standard pull-request CI verifies profile metadata, rejected database combinations, model and relation validation, safe search and sort allowlists, backend-native CRUD and foreign-key output for all five profiles, migration consistency, optional ZIP files, multi-entity browser configuration, invalid-model download prevention, accessibility, runtime errors, mobile overflow, and visual regression.

These gates validate the generator and file contracts. They do not claim that every generated Java, Python, Go, and Node.js repository has been installed and executed in isolation.

### Current limitations

Visual data models, belongs-to relations, foreign keys, referential actions, pagination, search, sorting, and baseline CRUD are complete. One-to-one, many-to-many, self and cyclic relations, remote relation search, compound indexes, authentication and authorization, cloud source versioning, isolated builds, online previews, and a real five-stack execution matrix remain future work.

Development continues on `Feature-dev-v0.1.0` and long-lived Draft PR #44 without expanding AI generation.
