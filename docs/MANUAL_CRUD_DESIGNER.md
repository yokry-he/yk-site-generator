# 手动数据模型、关系与 CRUD / Manual Data Models, Relations, and CRUD

[中文](#中文) · [English](#english)

---

## 中文

### 定位

`/projects/new` 的数据模型设计器不调用 AI。用户配置实体、字段、外键和列表查询后，SiteForge 使用确定性模板同时生成：

- Vue 3 管理界面
- 列表、新增、编辑和删除交互
- 服务端分页、搜索和排序
- REST CRUD API
- ORM Schema 或后端实体
- 数据库外键和迁移
- `openapi.yaml`
- `siteforge.json` schema v2 工程清单

相同配置会产生相同的资源名称、路由、查询协议和文件结构。

### 实体限制

- 每个工程最多 8 个实体
- 每个实体最多 20 个业务字段
- 每个实体最多 8 个属于关系
- 实体代码名使用 PascalCase，例如 `TaskItem`
- 字段和关系代码名使用 camelCase，例如 `publishedAt`、`assignee`
- API 路由使用小写英文、数字和连字符，例如 `/task-items`
- 实体名称和路由不能重复
- `id`、`createdAt`、`updatedAt` 是系统字段

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

每个字段可以配置必填、唯一、可搜索、可排序、列表展示、表单展示、枚举值和默认值。只有短文本、长文本和枚举可以进入全文搜索条件；其他字段即使旧配置声明 `searchable`，规范化时也会关闭。

### 属于关系与外键

第一版关系模型采用确定性的 `belongs-to`：

```text
User
└─ Task.assignee -> User
   └─ 生成 assigneeId 外键
```

规则：

- 关系目标必须是当前实体之前定义的实体
- 该限制避免循环依赖，并保证 Flyway、Alembic、Goose 和 SQL 建表顺序稳定
- 关系生成 `${name}Id`，例如 `assigneeId`
- 关系可以配置必填、列表展示、表单展示和排序
- 删除策略支持 `restrict`、`cascade` 和 `set-null`
- 必填关系不能使用 `set-null`
- 删除被引用实体时，设计器会移除指向它的关系并修复默认排序

五套后端会生成真实数据库外键。Spring 第一版在 JPA Entity 中保留标量外键字段，约束由 Flyway SQL 管理；其他档案同时生成对应 ORM 关系元数据。

### 列表查询协议

所有列表接口使用同一组查询参数：

```text
GET /api/articles?page=1&pageSize=25&search=guide&sort=publishedAt&order=desc
```

| 参数 | 约束 |
| --- | --- |
| `page` | 从 1 开始 |
| `pageSize` | 1 到 100；设计器默认值要求 5 到 100 |
| `search` | 只应用到明确标记为可搜索的字段 |
| `sort` | 只接受生成时写入白名单的字段 |
| `order` | `asc` 或 `desc` |

响应统一为：

```json
{
  "items": [],
  "total": 0,
  "page": 1,
  "pageSize": 25
}
```

排序字段不会直接拼接未经验证的用户输入。Hono、NestJS、FastAPI、Spring Boot 和 Gin 都生成自己的字段白名单。

### 生成的 API

对于路由为 `/articles` 的实体，会生成：

```text
GET    /api/articles
GET    /api/articles/:id
POST   /api/articles
PATCH  /api/articles/:id
DELETE /api/articles/:id
```

外键冲突或 `restrict` 删除失败时，后端返回数据库或框架对应的 4xx 错误，而不是静默删除关联数据。

### 多技术栈输出

- Hono：Drizzle 表、`.references()` 外键、Zod 输入、白名单排序和分页 CRUD
- NestJS：Prisma Relation、Unchecked DTO、事务计数和分页 Controller
- FastAPI：SQLAlchemy ForeignKey、Pydantic Schema、Alembic Revision 和分页 Router
- Spring Boot：标量外键、JpaSpecificationExecutor、PageRequest、Controller 和 Flyway SQL
- Gin：GORM Relation、资源 Handler、查询白名单和 Goose SQL

Spring 和 Gin 会覆盖第一阶段示例迁移文件，确保相同版本号只保留一份资源迁移。Gin 只导入所选 SQLite 或 PostgreSQL 驱动。

### 前端管理界面

生成的 Vue 应用可以：

- 在多个实体之间切换
- 搜索允许搜索的字段
- 切换排序字段和方向
- 分页浏览并显示总数
- 创建、编辑和删除记录
- 从目标实体列表选择外键记录
- 在列表中显示外键对应记录的主要字段
- 显示 API 错误、空状态和加载状态

关系下拉框最多加载目标实体前 100 条记录。更大数据集需要下一阶段的远程关系搜索组件。

### 安全与执行边界

SiteForge 当前只生成和下载源码 ZIP，不会安装或运行生成项目。隔离 Runner 上线前：

- 不执行依赖安装
- 不运行数据库迁移
- 不启动用户 API
- 不访问用户数据库
- 不写入真实 Secret

### 当前限制

本阶段暂不支持：

- 一对一、多对多和自引用关系
- 关系拖拽排序和循环依赖
- 关系下拉框的远程搜索
- 复合索引和复合唯一约束
- 认证、角色和字段级权限
- 文件、富文本和 JSON 字段
- 云端保存工程源码
- 在平台中实际编译五套生成工程

下一阶段优先实现认证、角色与路由权限，然后进入云端工程文件存储和隔离构建；AI 生成仍暂停扩展。

---

## English

### Purpose

The data-model designer at `/projects/new` does not call AI. After a user configures entities, fields, foreign keys, and list-query behavior, deterministic templates generate:

- A Vue 3 administration interface
- List, create, update, and delete interactions
- Server-side pagination, search, and sorting
- REST CRUD APIs
- ORM schemas or backend entities
- Database foreign keys and migrations
- `openapi.yaml`
- A schema-v2 `siteforge.json` engineering manifest

The same configuration produces the same resource names, routes, query protocol, and file structure.

### Entity limits

- Up to 8 entities per project
- Up to 20 business fields per entity
- Up to 8 belongs-to relations per entity
- Entity identifiers use PascalCase
- Field and relation identifiers use camelCase
- API routes use lowercase letters, numbers, and hyphens
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

Fields can be required, unique, searchable, sortable, visible in lists or forms, and can define enum and default values. Only text, long-text, and enum fields participate in search.

### Belongs-to relations and foreign keys

The initial relationship model is deterministic `belongs-to`:

```text
User
└─ Task.assignee -> User
   └─ generates assigneeId
```

A target must appear before the source entity. This prevents cycles and keeps migration ordering deterministic. Relations generate `${name}Id`, support required and visibility settings, and accept `restrict`, `cascade`, or `set-null` referential actions. Required relations cannot use `set-null`.

All five backend profiles generate real database foreign keys. Spring initially exposes a scalar ID in the JPA entity while Flyway owns the constraint; the other profiles also generate ORM relation metadata.

### List-query protocol

Every list endpoint accepts:

```text
GET /api/articles?page=1&pageSize=25&search=guide&sort=publishedAt&order=desc
```

`page` starts at 1, `pageSize` is capped at 100, search only touches declared searchable fields, sort uses a generated allowlist, and order is `asc` or `desc`.

The response contract is:

```json
{
  "items": [],
  "total": 0,
  "page": 1,
  "pageSize": 25
}
```

Untrusted sort input is never appended directly to SQL. Every generated stack maps allowed API names to known columns or ORM fields.

### Generated API

An entity whose route is `/articles` receives list, detail, create, patch, and delete endpoints. Foreign-key conflicts and restricted deletes surface as 4xx errors instead of silently deleting related data.

### Backend-specific output

- Hono: Drizzle references, Zod input, allowlisted sorting, and paginated CRUD
- NestJS: Prisma relations, unchecked scalar inputs, transactional count and pagination
- FastAPI: SQLAlchemy foreign keys, Pydantic schemas, Alembic revisions, and paginated routers
- Spring Boot: scalar foreign keys, JpaSpecificationExecutor, PageRequest, controllers, and Flyway SQL
- Gin: GORM relations, handlers, query allowlists, and Goose SQL

Spring and Gin replace phase-one sample migrations, and Gin imports only the selected database driver.

### Generated frontend

The Vue application can switch resources, search, sort, paginate, create and edit records, delete records, select related records, display relation labels, and surface loading, empty, and API-error states. Relation selects load up to 100 target rows; remote relation search remains future work.

### Security and execution boundary

SiteForge still generates and downloads source ZIPs only. Until an isolated runner exists, it does not install dependencies, execute migrations, start generated APIs, access user databases, or write real secrets.

### Current limitations

This phase does not yet support one-to-one, many-to-many, or self-relations; cyclic dependency graphs; remote relation search; compound indexes; authentication, roles, or field-level authorization; file, rich-text, or JSON fields; cloud source storage; or real compilation of all five generated stacks inside SiteForge.

The next phase prioritizes authentication, roles, and route permissions before cloud engineering-file storage and isolated builds. AI-generation expansion remains paused.
