# SiteForge · yk-site-generator

![CI](https://github.com/yokry-he/yk-site-generator/actions/workflows/ci.yml/badge.svg)

[中文](#中文) · [English](#english) · [文档中心 / Documentation Hub](./docs/README.md)

---

## 中文

### 项目简介

SiteForge 是一个 AI 网站生成、编辑和发布平台。用户可以用一句话生成网站，也可以完全跳过模型配置，直接从内置成品项目或官方模板开始。

核心目标：

- 生成完整、可运行、可继续编辑的网站，而不是静态截图。
- 让 AI 成为可选的深度定制能力，而不是使用产品的前置条件。
- 同时重视生成质量、首屏体验、无障碍、安全、版本管理和部署可维护性。

技术栈：pnpm monorepo、Vue 3、TypeScript、Vite、Hono、Node.js、MySQL 8、Playwright、Vitest。

### 零配置体验

启动后打开：

```text
http://localhost:5173/starters
```

用户无需模型、API Key 或登录即可：

- 打开完整内置项目
- 切换桌面与手机预览
- 使用可视化编辑器
- 本地自动保存
- 导出 HTML/ZIP
- 创建临时分享

登录只用于云端项目、跨设备同步和不可变版本管理。

### 快速开始

推荐环境：Node.js 24、pnpm 11。

```bash
git clone https://github.com/yokry-he/yk-site-generator.git
cd yk-site-generator

corepack enable
corepack prepare pnpm@11 --activate
pnpm install --frozen-lockfile

cp apps/server/.env.example apps/server/.env
pnpm dev
```

服务端通过 `dotenv` 自动加载 `apps/server/.env`，不需要执行 `source` 或 `set -a`。

默认地址：

| 服务 | 地址 |
| --- | --- |
| Web | `http://localhost:5173` |
| API | `http://localhost:8787` |
| 健康检查 | `http://localhost:8787/api/health` |
| 内置项目 | `http://localhost:5173/starters` |

完整本地开发说明：[`docs/DEVELOPMENT.md`](./docs/DEVELOPMENT.md)

### 已实现能力

#### 生成与迭代

- OpenAI 兼容、Anthropic、Gemini 多 Provider SSE 流式适配
- 极速草稿、平衡生成、精致成品三档策略
- 结构化需求向导和可编辑需求摘要
- 多轮迭代、历史轮次预览与回退
- 局部 AI 修改、主动停止、失败重试和部分结果保留
- Token 分片批量提交，降低 Vue 更新和 iframe 重载成本
- 首 token、总耗时、输出大小、模型、站点类型和解析结果观测

#### 内置项目与官方模板

- 6 个无需模型和登录的内置成品项目
- 24 套官方模板，覆盖商业、个人、内容、教育、餐饮和数据可视化场景
- 模板搜索、筛选、收藏、配色变体、品牌联动和多端预览
- 模板与内置项目可以创建云端项目，也可以进入 AI 深度定制

#### 可视化编辑器

- 页面结构树、区块插入、复制、排序、隐藏、锁定和删除
- 文字、图片、链接、按钮和样式直接编辑
- 桌面、平板、手机断点样式覆盖
- 撤销、重做、自动草稿和快捷键
- 保存为不可变新版本
- 手机端编辑 Sheet

#### 项目、版本与发布

- 项目 CRUD、收藏、复制、归档、回收站和永久删除确认
- 不可变版本、父版本关系、版本元数据、双版本对比和回滚
- JSON 文件与 MySQL 8 存储适配器
- 本地目录或 S3 兼容对象存储发布
- 临时分享、发布、重新发布和下线
- 月度额度、使用记录和失败退回

#### 品牌与质量

- 品牌套件、Logo、Favicon、颜色、字体、圆角、按钮和阴影
- 品牌资源库、标签、Alt、关联和跨项目复用
- 内容、图片、链接、响应式、无障碍和 SEO 质量检查
- 0–100 分级、问题筛选、元素定位和安全自动修复

#### 运营与安全

- 邮箱验证码、访问／刷新令牌、会话撤销
- Admin/Support/User 细粒度 RBAC
- 功能开关、灰度、模板运营、反馈和审计日志
- Provider URL 字面地址与 DNS SSRF 防护
- 品牌图片内容级校验与静态 SVG 策略
- 项目、版本、发布、品牌套件和资源跨账号隔离矩阵

### 目录结构

```text
yk-site-generator/
├── apps/
│   ├── web/                 # Vue 3 frontend
│   └── server/              # Hono Node.js API
├── packages/
│   ├── shared/              # Artifact protocol, templates, brands, starters
│   └── prompts/             # Generation prompts and evaluation
├── docs/                    # Bilingual contributor and operator documentation
├── deploy/                  # Preview/deployment entry point
├── apps/server/db/          # Numbered MySQL migrations
└── .github/workflows/       # CI, Preview, optional real-model workflows
```

### 常用命令

```bash
pnpm dev
pnpm lint
pnpm typecheck
pnpm test
pnpm build

pnpm --filter web e2e:browser
pnpm --filter web e2e:visual
pnpm --filter web check:bundle-budget
pnpm --filter prompts eval:quality -- --dry-run
pnpm --filter server db:mysql:check
```

浏览器测试首次需要：

```bash
pnpm --filter web exec playwright install chromium
```

### 数据存储

本地／单实例：

```env
DATA_STORAGE_DRIVER=file
DATA_STORAGE_FILE=.data/siteforge.json
```

正式多实例：

```env
DATA_STORAGE_DRIVER=mysql
MYSQL_URL=mysql://siteforge:password@mysql.internal:3306/siteforge
MYSQL_CONNECTION_LIMIT=10
MYSQL_SSL_MODE=required
```

数据库变更按顺序执行 `apps/server/db/*.sql`。迁移、导入、导出和回滚流程见开发与部署指南。

### 生产部署

构建产物：

- `apps/web/dist`：静态前端
- `apps/server/dist/index.js`：Node.js 服务端

分域部署时，前端构建需要：

```bash
VITE_API_BASE_URL=https://api.example.com pnpm --filter web build
```

生产环境至少需要正确配置：

- `AUTH_JWT_SECRET`
- `CORS_ORIGINS`
- `PUBLIC_BASE_URL`
- 数据存储
- 邮件 Webhook
- 持久卷或 S3 兼容对象存储

完整步骤、Nginx 示例、MySQL Migration、监控、备份和回滚：[`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md)

### 文档导航

| 文档 | 内容 |
| --- | --- |
| [`docs/DEVELOPMENT.md`](./docs/DEVELOPMENT.md) | 本地开发、环境变量、MySQL、测试与调试 |
| [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md) | 生产构建、Nginx、Vercel、MySQL、S3、监控与回滚 |
| [`docs/BUILTIN_PROJECTS.md`](./docs/BUILTIN_PROJECTS.md) | 内置成品项目 |
| [`docs/GENERATION_QUALITY.md`](./docs/GENERATION_QUALITY.md) | 生成策略、质量约束与性能 |
| [`docs/BETA_READINESS.md`](./docs/BETA_READINESS.md) | Beta 门槛和后续工作 |
| [`docs/SECURITY_ABUSE.md`](./docs/SECURITY_ABUSE.md) | 安全策略和对抗测试 |
| [`apps/web/tests/e2e/README.md`](./apps/web/tests/e2e/README.md) | Playwright、Axe 与视觉回归 |

所有开发和部署 Markdown 文档必须在同一文件中同时维护中文和英文。

---

## English

### Overview

SiteForge is an AI website generation, editing, and publishing platform. Users can generate a site from one sentence or skip model setup entirely and start from a built-in starter project or an official template.

Core goals:

- Produce complete, runnable, editable websites rather than static screenshots.
- Keep AI as an optional deep-customization capability instead of a product prerequisite.
- Treat generation quality, first-screen experience, accessibility, security, versioning, and operational maintainability as first-class concerns.

Stack: pnpm monorepo, Vue 3, TypeScript, Vite, Hono, Node.js, MySQL 8, Playwright, and Vitest.

### Zero-configuration experience

After startup, open:

```text
http://localhost:5173/starters
```

Without a model, API key, or login, users can:

- Open a complete starter project
- Switch desktop and mobile previews
- Use the visual editor
- Autosave locally
- Export HTML/ZIP
- Create a temporary share

Authentication is required only for cloud projects, cross-device sync, and immutable version management.

### Quick start

Recommended environment: Node.js 24 and pnpm 11.

```bash
git clone https://github.com/yokry-he/yk-site-generator.git
cd yk-site-generator

corepack enable
corepack prepare pnpm@11 --activate
pnpm install --frozen-lockfile

cp apps/server/.env.example apps/server/.env
pnpm dev
```

The server loads `apps/server/.env` automatically through `dotenv`; no `source` or `set -a` step is required.

Default URLs:

| Service | URL |
| --- | --- |
| Web | `http://localhost:5173` |
| API | `http://localhost:8787` |
| Health | `http://localhost:8787/api/health` |
| Starter projects | `http://localhost:5173/starters` |

Full local setup: [`docs/DEVELOPMENT.md`](./docs/DEVELOPMENT.md)

### Implemented capabilities

#### Generation and iteration

- OpenAI-compatible, Anthropic, and Gemini provider adapters with SSE streaming
- Fast draft, balanced, and quality generation modes
- Structured requirement wizard and editable requirement summary
- Multi-round iteration, historical preview, and rollback
- Local AI edits, cancellation, retry, and partial-output retention
- Batched token commits to reduce Vue updates and iframe reloads
- First-token, total-duration, output-size, model, site-type, and parse-result observability

#### Starter projects and official templates

- Six starter projects requiring neither a model nor authentication
- Twenty-four official templates spanning business, personal, content, education, restaurant, and data-visualization scenarios
- Search, filters, favorites, palette variants, brand integration, and responsive previews
- Templates and starters can create cloud projects or enter AI deep customization

#### Visual editor

- Semantic structure tree plus block insert, copy, reorder, hide, lock, and delete
- Direct editing of text, images, links, buttons, and styles
- Desktop, tablet, and mobile breakpoint overrides
- Undo, redo, autosave drafts, and keyboard shortcuts
- Immutable version saves
- Mobile editing sheet

#### Projects, versions, and publishing

- Project CRUD, favorites, copy, archive, trash, and permanent-delete confirmation
- Immutable versions, parent relationships, metadata, side-by-side comparison, and rollback
- JSON file and MySQL 8 storage adapters
- Local-directory or S3-compatible publishing
- Temporary shares, publish, republish, and unpublish
- Monthly quota, usage records, and automatic refunds for failed requests

#### Brand and quality

- Brand kits for logos, favicons, colors, fonts, radii, buttons, and shadows
- Brand asset library with tags, alt text, relationships, and cross-project reuse
- Content, image, link, responsive, accessibility, and SEO checks
- 0–100 scoring, filtering, element targeting, and safe automatic fixes

#### Operations and security

- Email verification codes, access/refresh tokens, and session revocation
- Fine-grained Admin/Support/User RBAC
- Feature flags, rollout, template operations, feedback, and audit logs
- Literal-address and DNS SSRF protection for provider URLs
- Content-level brand-image validation and static SVG policy
- Cross-account isolation matrices for projects, versions, publications, brand kits, and assets

### Repository structure

```text
yk-site-generator/
├── apps/
│   ├── web/                 # Vue 3 frontend
│   └── server/              # Hono Node.js API
├── packages/
│   ├── shared/              # Artifact protocol, templates, brands, starters
│   └── prompts/             # Generation prompts and evaluation
├── docs/                    # Bilingual contributor and operator documentation
├── deploy/                  # Preview/deployment entry point
├── apps/server/db/          # Numbered MySQL migrations
└── .github/workflows/       # CI, Preview, optional real-model workflows
```

### Common commands

```bash
pnpm dev
pnpm lint
pnpm typecheck
pnpm test
pnpm build

pnpm --filter web e2e:browser
pnpm --filter web e2e:visual
pnpm --filter web check:bundle-budget
pnpm --filter prompts eval:quality -- --dry-run
pnpm --filter server db:mysql:check
```

Install the browser once:

```bash
pnpm --filter web exec playwright install chromium
```

### Data storage

Local/single-instance:

```env
DATA_STORAGE_DRIVER=file
DATA_STORAGE_FILE=.data/siteforge.json
```

Production multi-instance:

```env
DATA_STORAGE_DRIVER=mysql
MYSQL_URL=mysql://siteforge:password@mysql.internal:3306/siteforge
MYSQL_CONNECTION_LIMIT=10
MYSQL_SSL_MODE=required
```

Apply database changes from `apps/server/db/*.sql` in order. See the development and deployment guides for migration, import, export, and rollback procedures.

### Production deployment

Build outputs:

- `apps/web/dist`: static frontend
- `apps/server/dist/index.js`: Node.js server

For split-domain deployments, build Web with:

```bash
VITE_API_BASE_URL=https://api.example.com pnpm --filter web build
```

Production requires correct configuration for at least:

- `AUTH_JWT_SECRET`
- `CORS_ORIGINS`
- `PUBLIC_BASE_URL`
- Data storage
- Email webhook
- Persistent volumes or S3-compatible object storage

Complete instructions, Nginx example, MySQL migrations, monitoring, backup, and rollback: [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md)

### Documentation

| Document | Scope |
| --- | --- |
| [`docs/DEVELOPMENT.md`](./docs/DEVELOPMENT.md) | Local setup, environment variables, MySQL, testing, and debugging |
| [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md) | Production build, Nginx, Vercel, MySQL, S3, monitoring, and rollback |
| [`docs/BUILTIN_PROJECTS.md`](./docs/BUILTIN_PROJECTS.md) | Built-in starter projects |
| [`docs/GENERATION_QUALITY.md`](./docs/GENERATION_QUALITY.md) | Generation modes, quality constraints, and performance |
| [`docs/BETA_READINESS.md`](./docs/BETA_READINESS.md) | Beta gates and next work |
| [`docs/SECURITY_ABUSE.md`](./docs/SECURITY_ABUSE.md) | Security policies and adversarial testing |
| [`apps/web/tests/e2e/README.md`](./apps/web/tests/e2e/README.md) | Playwright, Axe, and visual regression |

Every development and deployment Markdown document must maintain Chinese and English in the same file.
