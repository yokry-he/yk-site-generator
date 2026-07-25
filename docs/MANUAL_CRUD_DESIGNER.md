# 手动数据模型与 CRUD / Manual Data Models and CRUD

[中文](#中文) · [English](#english)

---

## 中文

### 定位

`/projects/new` 的数据模型设计器不调用 AI。用户配置实体和字段后，SiteForge 使用确定性模板同时生成：

- Vue 3 管理界面
- 列表、新增、编辑和删除交互
- REST CRUD API
- ORM Schema 或后端实体
- 数据库迁移
- `openapi.yaml`
- `siteforge.json` schema v2 工程清单

相同配置会产生相同的资源名称、路由和文件结构。

### 实体限制

- 每个工程最多 8 个实体
- 每个实体最多 20 个业务字段
- 实体代码名使用 PascalCase，例如 `TaskItem`
- 字段代码名使用 camelCase，例如 `publishedAt`
- API 路由使用小写英文、数字和连字符，例如 `/task-items`
- 实体名称和路由不能重复
- `id`、`createdAt`、`updatedAt` 是系统字段，不能手工创建

### 字段类型

| 类型 | 前端控件 | 数据库语义 |
| --- | --- | --- |
| `text` | 单行文本 | String / Text |
| `long-text` | 多行文本 | Text |
| `integer` | 整数输入 | Integer |
| `decimal` | 小数输入 | Numeric / Float |
| `boolean` | 复选框 | Boolean |
| `date` | 日期输入 | Date |
| `datetime` | 日期时间输入 | Timestamp / DateTime |
| `enum` | 下拉选择 | 受限字符串 |

每个字段还可以配置：

- 必填
- 唯一
- 是否显示在列表中
- 是否显示在表单中
- 枚举值
- 默认值（协议已支持，后续继续完善设计器输入）

### 生成的 API

对于路由为 `/articles` 的实体，会生成：

```text
GET    /api/articles
GET    /api/articles/:id
POST   /api/articles
PATCH  /api/articles/:id
DELETE /api/articles/:id
```

Hono、NestJS、FastAPI、Spring Boot 和 Gin 使用各自框架及 ORM 的原生实现，不生成统一的伪后端。

### 多技术栈输出

- Hono：Drizzle 表、Zod 输入校验、Drizzle CRUD
- NestJS：Prisma Model、PrismaService 和资源 Controller
- FastAPI：SQLAlchemy Model、Pydantic Schema 和 Router
- Spring Boot：JPA Entity、Repository、Controller 和 Flyway SQL
- Gin：GORM Model、资源 Handler 和 Goose SQL

Spring 和 Gin 会覆盖第一阶段的示例迁移文件，确保每个版本号只保留一份实际资源迁移。Gin 只导入用户选择的 SQLite 或 PostgreSQL 驱动。

### 前端管理界面

生成的 Vue 应用可以：

- 在多个实体之间切换
- 从 API 加载列表
- 创建和编辑记录
- 删除记录
- 根据字段类型渲染文本、数字、日期、枚举、布尔和长文本控件
- 显示 API 错误和空状态

### 安全与执行边界

SiteForge 当前只生成和下载源码 ZIP，不会安装或运行生成项目。隔离 Runner 上线前：

- 不执行依赖安装
- 不运行数据库迁移
- 不启动用户 API
- 不访问用户数据库
- 不写入真实 Secret

### 自动验证

标准 CI 验证：

- 数据模型标识符、路由、枚举、重复项和规模限制
- 五套后端均生成实体、CRUD、迁移和 OpenAPI
- `siteforge.json` schema v2 保存规范化后的实体定义
- ZIP 中无重复路径
- Spring 只保留一个 V1 Flyway 迁移
- Gin 只导入选定数据库驱动并生成匹配的 Goose SQL
- 浏览器可以新增第二个实体和枚举字段
- 非法路由会显示错误并禁用 ZIP 下载
- 桌面和手机端无严重 Axe 问题、运行时异常或横向溢出
- 原有桌面和移动端视觉快照无回退

完整浏览器套件已在 CI Run `30151277253` 通过。

### 当前限制

本阶段暂不支持：

- 实体之间的一对一、一对多和多对多关系
- 外键和级联删除策略
- 认证、角色和字段级权限
- 文件、富文本和 JSON 字段
- 服务端分页、搜索和排序配置
- 云端保存工程源码
- 在平台中实际编译五套生成工程

下一阶段优先实现关系设计、分页搜索和认证权限模块；AI 生成仍暂停扩展。

---

## English

### Purpose

The data-model designer at `/projects/new` does not call AI. After a user configures entities and fields, deterministic templates generate all of the following from the same model:

- A Vue 3 administration interface
- List, create, update, and delete interactions
- REST CRUD APIs
- ORM schemas or backend entities
- Database migrations
- `openapi.yaml`
- A schema-v2 `siteforge.json` engineering manifest

The same configuration produces the same resource names, routes, and file structure.

### Entity limits

- Up to 8 entities per project
- Up to 20 business fields per entity
- Entity identifiers use PascalCase, such as `TaskItem`
- Field identifiers use camelCase, such as `publishedAt`
- API routes use lowercase letters, numbers, and hyphens, such as `/task-items`
- Entity names and routes must be unique
- `id`, `createdAt`, and `updatedAt` are reserved system fields

### Field types

| Type | Frontend control | Database meaning |
| --- | --- | --- |
| `text` | Single-line input | String / Text |
| `long-text` | Multiline input | Text |
| `integer` | Integer input | Integer |
| `decimal` | Decimal input | Numeric / Float |
| `boolean` | Checkbox | Boolean |
| `date` | Date input | Date |
| `datetime` | Date-time input | Timestamp / DateTime |
| `enum` | Select input | Constrained string |

A field can also specify whether it is required or unique, whether it appears in list and form views, its enum values, and a protocol-level default value.

### Generated API

An entity whose route is `/articles` receives:

```text
GET    /api/articles
GET    /api/articles/:id
POST   /api/articles
PATCH  /api/articles/:id
DELETE /api/articles/:id
```

Hono, NestJS, FastAPI, Spring Boot, and Gin use native framework and ORM implementations rather than a shared mock backend.

### Backend-specific output

- Hono: Drizzle tables, Zod input validation, and Drizzle CRUD
- NestJS: Prisma models, PrismaService, and resource controllers
- FastAPI: SQLAlchemy models, Pydantic schemas, and routers
- Spring Boot: JPA entities, repositories, controllers, and Flyway SQL
- Gin: GORM models, resource handlers, and Goose SQL

Spring and Gin replace the phase-one sample migration so that a migration version has exactly one resource definition. Gin imports only the selected SQLite or PostgreSQL driver.

### Generated frontend

The generated Vue application can switch between resources, load API lists, create and edit records, delete records, render controls based on field type, and display API errors and empty states.

### Security and execution boundary

SiteForge currently generates and downloads source ZIPs only. Until an isolated runner exists, it does not install dependencies, execute migrations, start generated APIs, access user databases, or write real secrets.

### Automated validation

Standard CI validates identifiers, routes, enum values, duplicates, limits, native CRUD and migration output for all five backends, schema-v2 manifests, unique ZIP paths, one Spring V1 migration, selected Gin drivers and Goose SQL, multi-entity browser configuration, invalid-route download prevention, Axe accessibility, runtime errors, mobile overflow, and existing visual snapshots.

The complete browser suite passed in CI Run `30151277253`.

### Current limitations

This phase does not yet support entity relationships, foreign keys, cascade policies, authentication, roles, field-level authorization, file or JSON fields, configurable server-side pagination and search, cloud source storage, or real compilation of all five generated stacks inside SiteForge.

The next phase prioritizes relationships, pagination/search, and authentication/authorization modules. AI-generation expansion remains paused.
