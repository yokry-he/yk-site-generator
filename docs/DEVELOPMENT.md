# SiteForge 开发指南 / Development Guide

[中文](#中文) · [English](#english)

---

## 中文

### 1. 适用范围

本文档面向本地开发、功能调试、测试和贡献者工作流。生产部署请阅读 [`DEPLOYMENT.md`](./DEPLOYMENT.md)。

SiteForge 是一个 pnpm monorepo：

- `apps/web`：Vue 3、TypeScript、Vite、Vue Router、Tailwind CSS
- `apps/server`：Hono、Node.js、认证、项目、模板、品牌、分享、发布和运营 API
- `packages/shared`：共享类型、产物协议、品牌系统、官方模板与内置项目
- `packages/prompts`：站点 Prompt、迭代 Prompt 和质量评测

### 2. 运行要求

仓库 `engines` 的最低要求是 Node.js 20 与 pnpm 9。为与 CI 完全一致，推荐使用：

- Node.js 24
- pnpm 11
- Git 2.40+
- 可选：Docker Desktop 或兼容的 Docker Engine，用于 MySQL 8.4

使用 `nvm` 和 Corepack：

```bash
nvm install 24
nvm use 24
corepack enable
corepack prepare pnpm@11 --activate

node --version
pnpm --version
```

### 3. 获取代码与安装依赖

```bash
git clone https://github.com/yokry-he/yk-site-generator.git
cd yk-site-generator
pnpm install --frozen-lockfile
```

开发堆叠 PR 时，应检出对应 PR 的 head 分支，而不是直接在 `main` 上开发：

```bash
git fetch origin
git switch --track origin/<branch-name>
```

如果本地分支已经存在：

```bash
git switch <branch-name>
git pull --ff-only
```

### 4. 环境变量

首次运行：

```bash
cp apps/server/.env.example apps/server/.env
```

服务端通过 `dotenv` 自动读取固定路径 `apps/server/.env`，因此不需要执行 `source`、`set -a` 或手动导出变量。

优先级为：

1. 操作系统、Docker、CI 或托管平台已经注入的环境变量
2. `apps/server/.env`
3. Zod Schema 中的默认值

`dotenv` 使用 `override: false`，不会覆盖已经存在的 `process.env`。修改 `.env` 后需要重启服务端进程。

本地最小配置：

```env
NODE_ENV=development
PORT=8787
CORS_ORIGINS=http://localhost:5173
DATA_STORAGE_DRIVER=file
DATA_STORAGE_FILE=.data/siteforge.json
ADMIN_EMAILS=admin@example.com
```

不要把 `apps/server/.env` 提交到 Git。生产密钥不得复制到本地示例文件或测试日志中。

### 5. 快速启动：文件存储模式

默认配置使用文件存储，不需要数据库：

```bash
pnpm dev
```

默认地址：

| 服务 | 地址 |
| --- | --- |
| Web | `http://localhost:5173` |
| API | `http://localhost:8787` |
| 健康检查 | `http://localhost:8787/api/health` |
| 内置成品项目 | `http://localhost:5173/starters` |

根目录 `pnpm dev` 会并行启动 Web 和 Server。Vite 开发服务器将 `/api/`、`/s/` 和 `/site/` 代理到 Hono。

只启动单个工作区：

```bash
pnpm --filter web dev
pnpm --filter server dev
```

使用不同的本地 API 地址：

```bash
VITE_DEV_SERVER_TARGET=http://127.0.0.1:8787 pnpm --filter web dev
```

### 6. 本地登录

开发环境未配置 `EMAIL_WEBHOOK_URL` 时，请求验证码的响应会包含 `debugCode`，便于本地登录。生产环境不会返回调试验证码。

```bash
curl -X POST http://localhost:8787/api/auth/request-code \
  -H 'content-type: application/json' \
  -d '{"email":"admin@example.com"}'
```

将邮箱加入 `ADMIN_EMAILS` 后，该邮箱首次登录会获得管理员角色。修改管理员列表后需要重启服务端。

### 7. 使用 MySQL 8.4

#### 7.1 启动本地数据库

```bash
docker run -d \
  --name siteforge-mysql \
  -p 3306:3306 \
  -e MYSQL_ROOT_PASSWORD=root-password \
  -e MYSQL_DATABASE=siteforge \
  -e MYSQL_USER=siteforge \
  -e MYSQL_PASSWORD=siteforge-password \
  mysql:8.4
```

等待就绪：

```bash
docker exec siteforge-mysql \
  mysqladmin ping -h 127.0.0.1 -uroot -proot-password
```

#### 7.2 执行 Migration

按文件名顺序执行全部编号 SQL：

```bash
for file in apps/server/db/*.sql; do
  echo "Applying $file"
  docker exec -i siteforge-mysql \
    mysql -usiteforge -psiteforge-password siteforge < "$file"
done
```

#### 7.3 切换存储驱动

编辑 `apps/server/.env`：

```env
DATA_STORAGE_DRIVER=mysql
MYSQL_URL=mysql://siteforge:siteforge-password@127.0.0.1:3306/siteforge
MYSQL_CONNECTION_LIMIT=10
MYSQL_SSL_MODE=disabled
MYSQL_CONNECT_TIMEOUT_MS=10000
```

检查连接与 Schema：

```bash
pnpm --filter server db:mysql:check
```

然后重启：

```bash
pnpm dev
```

`db:mysql:ci` 是破坏性的 CI 验证命令，会导入测试快照并执行并发写入。不要对包含真实开发数据的数据库运行：

```bash
pnpm --filter server db:mysql:ci
```

### 8. JSON 与 MySQL 数据迁移

JSON → MySQL 预检：

```bash
pnpm --filter server db:mysql:import -- --dry-run --file=.data/siteforge.json
```

首次导入空数据库：

```bash
pnpm --filter server db:mysql:import -- --file=.data/siteforge.json
```

目标数据库已有快照时默认拒绝覆盖。只有明确理解风险后才使用 `--force`；命令会在覆盖前生成回滚快照。

MySQL → JSON：

```bash
pnpm --filter server db:mysql:export -- --output=.data/mysql-rollback.json
```

### 9. 模型配置与本地模型

不配置模型时，以下功能仍可使用：

- 内置成品项目
- 官方模板预览
- 可视化编辑器
- 本地草稿和导出
- 项目与品牌相关的非生成能力

调用 AI 时，在 Web 界面的“模型设置”中配置 Provider、API Key、Base URL 和 Model。API Key 只随请求传输，服务端不持久化、不写日志。

连接 Ollama、LM Studio 或其他本机／内网服务时，仅在可信本地开发环境设置：

```env
ALLOW_PRIVATE_PROVIDER_BASE_URLS=true
```

公共生产环境禁止开启该选项。

### 10. 常用命令

| 命令 | 用途 |
| --- | --- |
| `pnpm dev` | 并行启动 Web 和 Server |
| `pnpm build` | 构建全部工作区 |
| `pnpm lint` | 运行所有可用 Lint |
| `pnpm typecheck` | 运行严格 TypeScript 检查 |
| `pnpm test` | 运行全部 Vitest 测试 |
| `pnpm --filter web check:bundle-budget` | 检查 Web Bundle 预算 |
| `pnpm --filter prompts eval:quality -- --dry-run` | 验证 Prompt 评测管线，不调用真实模型 |
| `pnpm --filter server db:mysql:check` | 检查 MySQL 连接、Schema 与快照 |
| `pnpm --filter web e2e:history` | 验证 IndexedDB 历史恢复 |

### 11. 浏览器、无障碍与视觉测试

首次安装 Chromium：

```bash
pnpm --filter web exec playwright install chromium
```

运行：

```bash
pnpm --filter web e2e:browser
pnpm --filter web e2e:visual
```

仅在产品改动确实需要更新视觉基线时执行：

```bash
pnpm --filter web e2e:visual:update
```

行为测试必须先通过。视觉失败不能通过无条件更新截图来掩盖。

### 12. 真实模型 E2E 与质量评测

CI 只有在配置以下 Secrets 后才执行真实模型生成与迭代：

```text
EVAL_API_KEY
EVAL_BASE_URL
EVAL_MODEL
```

本地质量矩阵示例：

```bash
EVAL_BASE_URL=https://provider.example.com/v1 \
EVAL_API_KEY=replace-me \
EVAL_MODEL=model-name \
pnpm --filter prompts eval:quality -- --runs 3
```

无凭据时使用 `--dry-run`，不能把 dry-run 结果当作真实生成质量结论。

### 13. 构建产物

```bash
pnpm build
```

主要产物：

- `apps/web/dist`：可部署到静态托管或 CDN 的前端文件
- `apps/server/dist/index.js`：Node.js 服务端入口

本地检查生产前端：

```bash
pnpm --filter web preview
```

生产环境不要使用 Vite `preview` 作为正式 Web Server。

### 14. 调试建议

#### Web 无法访问 API

- 确认 `http://localhost:8787/api/health` 正常。
- 检查 `VITE_DEV_SERVER_TARGET`。
- 分域部署时检查构建期 `VITE_API_BASE_URL` 和服务端 `CORS_ORIGINS`。

#### 环境变量没有生效

- 确认文件路径为 `apps/server/.env`。
- 修改后重启 Server。
- 检查同名系统环境变量是否覆盖 `.env`。

#### MySQL 启动失败

- 确认所有 migration 已按编号执行。
- 检查 `MYSQL_SSL_MODE`；本地 Docker 通常使用 `disabled`。
- 运行 `pnpm --filter server db:mysql:check` 获取明确诊断。

#### Playwright 失败

- 先确认 Chromium 已安装。
- 查看 `apps/web/playwright-report` 与 `apps/web/test-results`。
- 不要忽略 `pageerror`、Axe serious/critical 或移动端横向溢出。

### 15. 提交前检查

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm build
pnpm test
pnpm --filter web e2e:browser
pnpm --filter web e2e:visual
```

数据库相关改动还必须运行 MySQL 8.4 集成验证。Prompt 或生成协议改动必须运行 Prompt dry-run，并在具备固定模型与预算时运行真实模型矩阵。

### 16. 分支与文档规则

- 从明确的 base 分支创建功能分支，不直接在 `main` 上堆叠开发。
- 大型工作拆成可独立审查的 Draft PR。
- 不在没有用户明确指令时合并或标记 Ready for review。
- 所有面向开发者与部署人员的 Markdown 文档必须同时维护中文和英文。
- 代码行为变化与文档更新必须在同一个 PR 中完成。

---

## English

### 1. Scope

This guide covers local development, feature debugging, testing, and contributor workflows. For production operations, see [`DEPLOYMENT.md`](./DEPLOYMENT.md).

SiteForge is a pnpm monorepo:

- `apps/web`: Vue 3, TypeScript, Vite, Vue Router, and Tailwind CSS
- `apps/server`: Hono on Node.js, authentication, projects, templates, brands, shares, publishing, and operations APIs
- `packages/shared`: shared types, artifact protocol, brand system, official templates, and starter projects
- `packages/prompts`: site prompts, iteration prompts, and quality evaluation

### 2. Requirements

The repository `engines` field declares Node.js 20 and pnpm 9 as minimums. To match CI exactly, use:

- Node.js 24
- pnpm 11
- Git 2.40+
- Optional: Docker Desktop or a compatible Docker Engine for MySQL 8.4

With `nvm` and Corepack:

```bash
nvm install 24
nvm use 24
corepack enable
corepack prepare pnpm@11 --activate

node --version
pnpm --version
```

### 3. Clone and install

```bash
git clone https://github.com/yokry-he/yk-site-generator.git
cd yk-site-generator
pnpm install --frozen-lockfile
```

When working on a stacked pull request, check out its head branch instead of developing directly on `main`:

```bash
git fetch origin
git switch --track origin/<branch-name>
```

For an existing local branch:

```bash
git switch <branch-name>
git pull --ff-only
```

### 4. Environment variables

First-time setup:

```bash
cp apps/server/.env.example apps/server/.env
```

The server loads the fixed path `apps/server/.env` through `dotenv`. You do not need `source`, `set -a`, or manual exports.

Precedence is:

1. Variables already injected by the operating system, Docker, CI, or the hosting platform
2. `apps/server/.env`
3. Defaults in the Zod schema

`dotenv` uses `override: false`, so it never replaces an existing `process.env` value. Restart the server after changing `.env`.

Minimal local configuration:

```env
NODE_ENV=development
PORT=8787
CORS_ORIGINS=http://localhost:5173
DATA_STORAGE_DRIVER=file
DATA_STORAGE_FILE=.data/siteforge.json
ADMIN_EMAILS=admin@example.com
```

Do not commit `apps/server/.env`. Production secrets must never be copied into examples or test logs.

### 5. Quick start with file storage

The default configuration uses file storage and requires no database:

```bash
pnpm dev
```

Default URLs:

| Service | URL |
| --- | --- |
| Web | `http://localhost:5173` |
| API | `http://localhost:8787` |
| Health | `http://localhost:8787/api/health` |
| Starter projects | `http://localhost:5173/starters` |

The root `pnpm dev` command starts Web and Server in parallel. Vite proxies `/api/`, `/s/`, and `/site/` to Hono.

Start a single workspace:

```bash
pnpm --filter web dev
pnpm --filter server dev
```

Use a different local API target:

```bash
VITE_DEV_SERVER_TARGET=http://127.0.0.1:8787 pnpm --filter web dev
```

### 6. Local authentication

When `EMAIL_WEBHOOK_URL` is not configured in development, the verification-code response contains `debugCode`. Production never returns this debug code.

```bash
curl -X POST http://localhost:8787/api/auth/request-code \
  -H 'content-type: application/json' \
  -d '{"email":"admin@example.com"}'
```

An email listed in `ADMIN_EMAILS` receives the administrator role on first login. Restart the server after changing this list.

### 7. MySQL 8.4

#### 7.1 Start a local database

```bash
docker run -d \
  --name siteforge-mysql \
  -p 3306:3306 \
  -e MYSQL_ROOT_PASSWORD=root-password \
  -e MYSQL_DATABASE=siteforge \
  -e MYSQL_USER=siteforge \
  -e MYSQL_PASSWORD=siteforge-password \
  mysql:8.4
```

Wait for readiness:

```bash
docker exec siteforge-mysql \
  mysqladmin ping -h 127.0.0.1 -uroot -proot-password
```

#### 7.2 Apply migrations

Apply every numbered SQL file in filename order:

```bash
for file in apps/server/db/*.sql; do
  echo "Applying $file"
  docker exec -i siteforge-mysql \
    mysql -usiteforge -psiteforge-password siteforge < "$file"
done
```

#### 7.3 Switch the storage driver

Edit `apps/server/.env`:

```env
DATA_STORAGE_DRIVER=mysql
MYSQL_URL=mysql://siteforge:siteforge-password@127.0.0.1:3306/siteforge
MYSQL_CONNECTION_LIMIT=10
MYSQL_SSL_MODE=disabled
MYSQL_CONNECT_TIMEOUT_MS=10000
```

Check connectivity and schema:

```bash
pnpm --filter server db:mysql:check
```

Then restart:

```bash
pnpm dev
```

`db:mysql:ci` is a destructive CI validation command. It imports a test snapshot and performs concurrent writes. Never run it against a database containing real development data:

```bash
pnpm --filter server db:mysql:ci
```

### 8. JSON and MySQL migration

JSON → MySQL dry run:

```bash
pnpm --filter server db:mysql:import -- --dry-run --file=.data/siteforge.json
```

First import into an empty database:

```bash
pnpm --filter server db:mysql:import -- --file=.data/siteforge.json
```

The command refuses to overwrite an existing snapshot by default. Use `--force` only when the risk is understood; a rollback snapshot is created before replacement.

MySQL → JSON:

```bash
pnpm --filter server db:mysql:export -- --output=.data/mysql-rollback.json
```

### 9. Model configuration and local models

Without a model configuration, users can still use:

- Starter projects
- Official-template previews
- The visual editor
- Local drafts and exports
- Non-generation project and brand features

For AI calls, configure Provider, API Key, Base URL, and Model in the Web “Model settings” dialog. API keys are transmitted only with the request; the server does not persist or log them.

For Ollama, LM Studio, or another trusted local/private service, set this only in a trusted development environment:

```env
ALLOW_PRIVATE_PROVIDER_BASE_URLS=true
```

Never enable it in a public production environment.

### 10. Common commands

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Start Web and Server in parallel |
| `pnpm build` | Build every workspace |
| `pnpm lint` | Run all available lint tasks |
| `pnpm typecheck` | Run strict TypeScript checks |
| `pnpm test` | Run all Vitest tests |
| `pnpm --filter web check:bundle-budget` | Enforce the Web bundle budget |
| `pnpm --filter prompts eval:quality -- --dry-run` | Validate the prompt-evaluation pipeline without model calls |
| `pnpm --filter server db:mysql:check` | Check MySQL connectivity, schema, and snapshot state |
| `pnpm --filter web e2e:history` | Verify IndexedDB history restoration |

### 11. Browser, accessibility, and visual tests

Install Chromium once:

```bash
pnpm --filter web exec playwright install chromium
```

Run:

```bash
pnpm --filter web e2e:browser
pnpm --filter web e2e:visual
```

Only update screenshots when a deliberate product change requires a new baseline:

```bash
pnpm --filter web e2e:visual:update
```

Behavior tests must pass first. Never hide a visual failure by unconditionally regenerating snapshots.

### 12. Real-model E2E and quality evaluation

CI performs real generation and iteration only when these secrets are configured:

```text
EVAL_API_KEY
EVAL_BASE_URL
EVAL_MODEL
```

Example local quality matrix:

```bash
EVAL_BASE_URL=https://provider.example.com/v1 \
EVAL_API_KEY=replace-me \
EVAL_MODEL=model-name \
pnpm --filter prompts eval:quality -- --runs 3
```

Without credentials, use `--dry-run`. A dry run must never be presented as evidence of real generation quality.

### 13. Build outputs

```bash
pnpm build
```

Primary outputs:

- `apps/web/dist`: static frontend assets for a static host or CDN
- `apps/server/dist/index.js`: Node.js server entry point

Preview the production frontend locally:

```bash
pnpm --filter web preview
```

Do not use Vite `preview` as a production Web server.

### 14. Troubleshooting

#### Web cannot reach the API

- Confirm `http://localhost:8787/api/health` works.
- Check `VITE_DEV_SERVER_TARGET`.
- For split-domain deployments, verify build-time `VITE_API_BASE_URL` and server-side `CORS_ORIGINS`.

#### Environment variables do not apply

- Confirm the path is `apps/server/.env`.
- Restart Server after editing.
- Check whether an environment variable with the same name is overriding the file.

#### MySQL startup fails

- Confirm every migration was applied in order.
- Check `MYSQL_SSL_MODE`; local Docker normally uses `disabled`.
- Run `pnpm --filter server db:mysql:check` for explicit diagnostics.

#### Playwright fails

- Confirm Chromium is installed.
- Inspect `apps/web/playwright-report` and `apps/web/test-results`.
- Do not ignore `pageerror`, Axe serious/critical violations, or mobile horizontal overflow.

### 15. Pre-commit verification

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm build
pnpm test
pnpm --filter web e2e:browser
pnpm --filter web e2e:visual
```

Database changes also require MySQL 8.4 integration validation. Prompt or artifact-protocol changes require the prompt dry run and, when a fixed model and budget are available, the real-model matrix.

### 16. Branch and documentation rules

- Create feature branches from an explicit base; do not stack development directly on `main`.
- Split large work into independently reviewable Draft PRs.
- Do not merge or mark a PR ready without explicit user instruction.
- Every contributor- and operator-facing Markdown document must maintain both Chinese and English sections.
- Runtime behavior and its documentation must change in the same pull request.
