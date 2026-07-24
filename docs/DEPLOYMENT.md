# SiteForge 部署指南 / Deployment Guide

[中文](#中文) · [English](#english)

---

## 中文

### 1. 部署架构

SiteForge 的生产产物分为两个独立部分：

- `apps/web/dist`：静态前端，可部署到 Vercel、Netlify、对象存储、CDN 或 Nginx
- `apps/server/dist/index.js`：Node.js 24 Hono 服务，需要持久化存储和公开 HTTPS 地址

推荐架构：

```text
Browser
  ├── https://app.example.com  -> Static Web / CDN
  └── https://api.example.com  -> Hono Node Server
                                    ├── MySQL 8.4
                                    ├── Email Webhook
                                    └── S3-compatible object storage
```

也可以使用同域反向代理，将 `/api/`、`/s/` 和 `/site/` 转发到 Hono，其余路径由静态 Web 服务处理。

### 2. 生产要求

- Node.js 24
- pnpm 11
- HTTPS 入口与有效证书
- 单实例 MVP：持久卷
- 多实例生产：MySQL 8.4
- 可选：S3、Cloudflare R2、MinIO 或兼容对象存储
- 可选：Vercel 用于 Web 与 PR Preview

生产环境不要使用 Vite `dev` 或 `preview` 作为正式 Web Server。

### 3. 构建

```bash
corepack enable
corepack prepare pnpm@11 --activate
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

构建结果：

```text
apps/web/dist/
apps/server/dist/index.js
```

如果前端和 API 分域，在构建 Web 之前设置：

```bash
VITE_API_BASE_URL=https://api.example.com pnpm --filter web build
```

`VITE_API_BASE_URL` 是构建期变量。修改后必须重新构建前端。

### 4. 生产环境变量

#### 4.1 必需基础配置

```env
NODE_ENV=production
PORT=8787
CORS_ORIGINS=https://app.example.com
PUBLIC_BASE_URL=https://api.example.com
AUTH_JWT_SECRET=<至少 32 字符的随机密钥>
MONTHLY_GENERATION_LIMIT=100
MAX_PROJECT_BYTES=2097152
```

生成密钥示例：

```bash
openssl rand -base64 48
```

`AUTH_JWT_SECRET` 必须针对每个环境独立生成，不得使用 `.env.example` 中的开发值。

多个前端 Origin 使用逗号分隔：

```env
CORS_ORIGINS=https://app.example.com,https://admin.example.com
```

#### 4.2 邮件验证码

```env
EMAIL_WEBHOOK_URL=https://mailer.example.com/send
EMAIL_WEBHOOK_TOKEN=<replace-me>
VERIFICATION_CODE_TTL_MIN=10
```

生产环境没有配置 `EMAIL_WEBHOOK_URL` 时，验证码请求会失败，不会向浏览器返回 `debugCode`。

#### 4.3 临时分享

```env
SHARE_STORAGE_DIR=/data/siteforge/shares
SHARE_TTL_DAYS=7
MAX_SHARE_BYTES=2097152
```

文件模式下 `SHARE_STORAGE_DIR` 必须位于持久卷。

### 5. 数据存储模式

#### 5.1 单实例文件模式

适合内部测试、演示环境或单实例 MVP：

```env
DATA_STORAGE_DRIVER=file
DATA_STORAGE_FILE=/data/siteforge/siteforge.json
SHARE_STORAGE_DIR=/data/siteforge/shares
PUBLISH_STORAGE_DIR=/data/siteforge/published
```

必须将 `/data/siteforge` 挂载为持久卷。文件存储通过进程内队列和原子重命名保护单实例写入，但不能让多个 Server 实例共同写同一文件。

扩容条件：只要需要多个 Server 副本，就必须切换到 MySQL，并将发布产物切换到共享对象存储。

#### 5.2 MySQL 8.4 多实例模式

```env
DATA_STORAGE_DRIVER=mysql
MYSQL_URL=mysql://siteforge:<password>@mysql.internal:3306/siteforge
MYSQL_CONNECTION_LIMIT=10
MYSQL_SSL_MODE=required
MYSQL_CONNECT_TIMEOUT_MS=10000
```

托管 MySQL 应使用 `MYSQL_SSL_MODE=required`。本地或可信私网调试可以使用 `disabled`，但不建议用于跨公网连接。

### 6. 数据库 Migration

部署新版本前，按文件名顺序执行 `apps/server/db/*.sql`：

```bash
for file in apps/server/db/*.sql; do
  echo "Applying $file"
  mysql "$MYSQL_URL" < "$file"
done
```

如果所用 MySQL CLI 不支持 URL，可拆分主机、用户、密码和数据库参数。

执行后检查：

```bash
pnpm --filter server db:mysql:check
```

建议流程：

1. 备份当前数据。
2. 在维护窗口或只读阶段执行 migration。
3. 运行 `db:mysql:check`。
4. 部署一个 Server 实例。
5. 完成登录、项目、版本、分享、发布冒烟测试。
6. 再扩容其他实例。

不要在多个实例持续写入时执行 `db:mysql:import -- --force`。

### 7. 首次 JSON → MySQL 迁移

预检：

```bash
MYSQL_URL='mysql://...' \
pnpm --filter server db:mysql:import -- --dry-run --file=/data/siteforge/siteforge.json
```

目标为空时导入：

```bash
MYSQL_URL='mysql://...' \
pnpm --filter server db:mysql:import -- --file=/data/siteforge/siteforge.json
```

验证：

```bash
MYSQL_URL='mysql://...' pnpm --filter server db:mysql:check
```

已有 MySQL 快照时默认拒绝覆盖。`--force` 会先导出回滚 JSON，但仍应先停止写流量。

### 8. 启动服务端

在包含生产依赖和构建产物的目录中：

```bash
pnpm --filter server start
```

也可以直接运行：

```bash
node apps/server/dist/index.js
```

进程管理器必须：

- 在异常退出后重启
- 传递 SIGTERM，而不是立即 SIGKILL
- 为健康检查预留启动时间
- 保存标准输出和标准错误，但避免记录 Secrets

健康检查：

```bash
curl --fail https://api.example.com/api/health
```

只有健康检查返回成功且 `dataStore.status` 为 `operational` 时才接入流量。

### 9. Nginx 同域示例

下面示例将静态前端和 API 放在同一个 Origin。`/api/` 包含 SSE，因此必须关闭代理缓冲并延长读取超时。

```nginx
server {
  listen 443 ssl http2;
  server_name app.example.com;

  root /srv/siteforge/apps/web/dist;
  index index.html;

  location /api/ {
    proxy_pass http://127.0.0.1:8787;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_buffering off;
    proxy_read_timeout 300s;
  }

  location /s/ {
    proxy_pass http://127.0.0.1:8787;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  location /site/ {
    proxy_pass http://127.0.0.1:8787;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  location / {
    try_files $uri $uri/ /index.html;
  }
}
```

同域模式可将 `VITE_API_BASE_URL` 留空，并设置：

```env
CORS_ORIGINS=https://app.example.com
PUBLIC_BASE_URL=https://app.example.com
```

### 10. 前后端分域

前端构建：

```bash
VITE_API_BASE_URL=https://api.example.com pnpm --filter web build
```

服务端：

```env
CORS_ORIGINS=https://app.example.com
PUBLIC_BASE_URL=https://api.example.com
```

要求：

- 两个域名都使用 HTTPS。
- CORS 必须精确列出允许的 Origin，不能在带凭据请求中使用 `*`。
- CDN 或代理不能缓冲 SSE。
- `/s/:id` 和 `/site/:slug` 必须通过 `PUBLIC_BASE_URL` 可公开访问。

### 11. S3 兼容发布

完整配置后，发布适配器会替代本地 `PUBLISH_STORAGE_DIR`：

```env
S3_ENDPOINT=https://<account>.r2.cloudflarestorage.com
S3_REGION=auto
S3_BUCKET=siteforge-sites
S3_ACCESS_KEY_ID=<replace-me>
S3_SECRET_ACCESS_KEY=<replace-me>
S3_PUBLIC_BASE_URL=https://sites.example.com
```

支持 AWS S3、Cloudflare R2、MinIO 和兼容的 path-style API。对象路径：

```text
sites/<slug>/index.html
```

可选 CDN 失效：

```env
CDN_INVALIDATION_WEBHOOK_URL=https://cdn.example.com/invalidate
CDN_INVALIDATION_WEBHOOK_TOKEN=<replace-me>
```

对象存储凭据只授予所需 Bucket 的最小读写权限。

### 12. Vercel 与 PR Preview

`.github/workflows/preview.yml` 会为 Pull Request 构建前端，并始终上传 `apps/web/dist` 工件。配置以下 Secrets 后还会创建 Vercel Preview：

```text
VERCEL_TOKEN
VERCEL_ORG_ID
VERCEL_PROJECT_ID
```

仓库变量：

```text
PREVIEW_API_BASE_URL
```

它用于在 Preview 构建时设置后端地址。未配置 Vercel Secrets 时，工作流只保留构建工件，不应失败。

生产 Web 也可以部署到 Vercel，但 Hono Server、MySQL 和持久化目录必须部署到独立的 Node.js 运行环境。

### 13. 邮件 Webhook 契约

服务端向邮件服务发送：

```json
{
  "to": "user@example.com",
  "template": "siteforge-login-code",
  "code": "123456",
  "expiresInMinutes": 10
}
```

邮件服务应：

- 校验 Bearer Token 或来源网络
- 不记录完整验证码
- 对请求设置限速和重试策略
- 将永久失败返回为非 2xx，让 SiteForge 明确提示发送失败

### 14. 安全检查

生产部署必须确认：

- `AUTH_JWT_SECRET` 已替换并安全保存
- `ALLOW_PRIVATE_PROVIDER_BASE_URLS=false`
- `CORS_ORIGINS` 不包含不可信域名
- 全链路 HTTPS
- 代理保留正确的 `X-Forwarded-Proto`
- 日志不包含 API Key、JWT、刷新令牌、验证码或邮件 Token
- 文件和对象存储不是公开目录浏览
- MySQL 用户仅拥有目标数据库所需权限
- 分享与发布页面的 CSP、Referrer-Policy 和 `nosniff` 未被代理覆盖

### 15. 发布前验证

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm --filter web e2e:browser
pnpm --filter web e2e:visual
pnpm --filter server db:mysql:check
```

业务冒烟测试：

1. `/api/health` 返回成功。
2. 请求验证码并完成登录。
3. 打开内置项目并完成编辑、导出。
4. 创建云端项目和不可变新版本。
5. 创建并删除临时分享。
6. 发布、重新发布和下线站点。
7. 管理后台显示正确的存储驱动、Schema、revision 和延迟。
8. 使用真实模型时验证 SSE 首 token、完整响应和主动停止。

### 16. 监控与告警

至少监控：

- `/api/health` 可用率和 P95 延迟
- Server 进程重启与未处理异常
- MySQL 连接错误、连接池耗尽、revision 停滞和 checksum 不匹配
- 验证码发送失败率和错误尝试次数
- Provider 错误分类、首 token、总生成耗时、SSE 中断率
- 月度额度预占、成功提交和失败退回
- 分享、发布和对象存储 4xx/5xx
- CDN 失效 Webhook 失败
- 磁盘和持久卷容量

告警和事件记录不得包含用户 API Key 或完整生成需求。

### 17. 备份

文件模式：

- 定期快照 `DATA_STORAGE_FILE`
- 同时备份分享和发布目录
- 在文件处于一致状态时复制，或先停止写流量

MySQL：

```bash
pnpm --filter server db:mysql:export -- --output=/backup/siteforge-rollback.json
```

同时使用数据库供应商的物理或逻辑备份。JSON 导出是应用级回滚桥梁，不应替代数据库级备份策略。

S3：

- 开启 Bucket 版本控制或对象生命周期策略
- 定期验证公开域名与对象权限
- 删除应用记录前不要立即永久删除历史对象，除非保留策略允许

### 18. 回滚

#### 18.1 应用版本

- 前端回滚到上一个成功的不可变构建或 Vercel Deployment。
- Server 回滚到上一个镜像／构建版本。
- 不要在回滚应用版本时删除持久卷、数据库或 Bucket。

#### 18.2 MySQL → 文件模式

1. 停止写流量或缩容至零。
2. 运行 `db:mysql:export`。
3. 设置 `DATA_STORAGE_DRIVER=file`。
4. 将 `DATA_STORAGE_FILE` 指向导出的 JSON。
5. 启动一个 Server 实例。
6. 完成健康检查和业务冒烟测试。
7. 恢复流量。

数据库结构变化必须保持旧版本可读，或提供独立、经过验证的逆向迁移方案。

### 19. 上线检查表

- [ ] 前端使用正确的 `VITE_API_BASE_URL` 构建
- [ ] Server 使用 Node.js 24
- [ ] 所有 Secrets 来自密钥管理系统
- [ ] MySQL migration 已按顺序执行
- [ ] `db:mysql:check` 成功
- [ ] 文件模式目录已挂载持久卷，或已使用 MySQL + S3
- [ ] CORS 与 `PUBLIC_BASE_URL` 正确
- [ ] 邮件 Webhook 可用
- [ ] SSE 未被代理缓冲
- [ ] 健康检查、监控、告警已配置
- [ ] 备份与恢复演练已完成
- [ ] Lint、Typecheck、测试、Axe 和视觉回归全部通过

---

## English

### 1. Deployment architecture

A production build has two independently deployable parts:

- `apps/web/dist`: static frontend assets for Vercel, Netlify, object storage, a CDN, or Nginx
- `apps/server/dist/index.js`: the Node.js 24 Hono server, which needs persistent storage and a public HTTPS URL

Recommended architecture:

```text
Browser
  ├── https://app.example.com  -> Static Web / CDN
  └── https://api.example.com  -> Hono Node Server
                                    ├── MySQL 8.4
                                    ├── Email Webhook
                                    └── S3-compatible object storage
```

A same-origin reverse proxy is also supported: forward `/api/`, `/s/`, and `/site/` to Hono and serve every other route from the static frontend.

### 2. Production requirements

- Node.js 24
- pnpm 11
- HTTPS ingress with a valid certificate
- Persistent volumes for a single-instance MVP
- MySQL 8.4 for multi-instance production
- Optional S3, Cloudflare R2, MinIO, or compatible object storage
- Optional Vercel for Web and PR Preview

Do not use Vite `dev` or `preview` as the production Web server.

### 3. Build

```bash
corepack enable
corepack prepare pnpm@11 --activate
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Outputs:

```text
apps/web/dist/
apps/server/dist/index.js
```

For separate frontend and API domains, set this before building Web:

```bash
VITE_API_BASE_URL=https://api.example.com pnpm --filter web build
```

`VITE_API_BASE_URL` is a build-time variable. Rebuild the frontend after changing it.

### 4. Production environment variables

#### 4.1 Required base configuration

```env
NODE_ENV=production
PORT=8787
CORS_ORIGINS=https://app.example.com
PUBLIC_BASE_URL=https://api.example.com
AUTH_JWT_SECRET=<random secret with at least 32 characters>
MONTHLY_GENERATION_LIMIT=100
MAX_PROJECT_BYTES=2097152
```

Generate a secret:

```bash
openssl rand -base64 48
```

Generate a different `AUTH_JWT_SECRET` for every environment. Never use the development value from `.env.example`.

Separate multiple frontend origins with commas:

```env
CORS_ORIGINS=https://app.example.com,https://admin.example.com
```

#### 4.2 Verification email

```env
EMAIL_WEBHOOK_URL=https://mailer.example.com/send
EMAIL_WEBHOOK_TOKEN=<replace-me>
VERIFICATION_CODE_TTL_MIN=10
```

In production, verification requests fail when `EMAIL_WEBHOOK_URL` is missing; the API never returns `debugCode` to the browser.

#### 4.3 Temporary shares

```env
SHARE_STORAGE_DIR=/data/siteforge/shares
SHARE_TTL_DAYS=7
MAX_SHARE_BYTES=2097152
```

With file storage, `SHARE_STORAGE_DIR` must be on a persistent volume.

### 5. Storage modes

#### 5.1 Single-instance file mode

Suitable for internal testing, demos, or a single-instance MVP:

```env
DATA_STORAGE_DRIVER=file
DATA_STORAGE_FILE=/data/siteforge/siteforge.json
SHARE_STORAGE_DIR=/data/siteforge/shares
PUBLISH_STORAGE_DIR=/data/siteforge/published
```

Mount `/data/siteforge` as a persistent volume. File storage uses an in-process queue and atomic rename for one instance, but multiple Server instances must not write the same file.

Scaling rule: as soon as more than one Server replica is required, move to MySQL and shared object storage for published sites.

#### 5.2 MySQL 8.4 multi-instance mode

```env
DATA_STORAGE_DRIVER=mysql
MYSQL_URL=mysql://siteforge:<password>@mysql.internal:3306/siteforge
MYSQL_CONNECTION_LIMIT=10
MYSQL_SSL_MODE=required
MYSQL_CONNECT_TIMEOUT_MS=10000
```

Use `MYSQL_SSL_MODE=required` with hosted MySQL. `disabled` is acceptable for trusted local/private development but should not be used across the public Internet.

### 6. Database migrations

Before deploying a new version, apply `apps/server/db/*.sql` in filename order:

```bash
for file in apps/server/db/*.sql; do
  echo "Applying $file"
  mysql "$MYSQL_URL" < "$file"
done
```

If the MySQL CLI does not accept a URL, split it into host, user, password, and database arguments.

After migration:

```bash
pnpm --filter server db:mysql:check
```

Recommended process:

1. Back up current data.
2. Apply migrations during a maintenance or read-only window.
3. Run `db:mysql:check`.
4. Deploy one Server instance.
5. Smoke-test login, projects, versions, shares, and publishing.
6. Scale out remaining instances.

Never run `db:mysql:import -- --force` while multiple instances are still accepting writes.

### 7. Initial JSON → MySQL migration

Dry run:

```bash
MYSQL_URL='mysql://...' \
pnpm --filter server db:mysql:import -- --dry-run --file=/data/siteforge/siteforge.json
```

Import into an empty target:

```bash
MYSQL_URL='mysql://...' \
pnpm --filter server db:mysql:import -- --file=/data/siteforge/siteforge.json
```

Verify:

```bash
MYSQL_URL='mysql://...' pnpm --filter server db:mysql:check
```

Existing MySQL snapshots are protected from overwrite by default. `--force` creates a rollback JSON first, but write traffic must still be stopped.

### 8. Start the server

From a directory containing production dependencies and build output:

```bash
pnpm --filter server start
```

Or directly:

```bash
node apps/server/dist/index.js
```

The process manager must:

- Restart after unexpected exits
- Deliver SIGTERM instead of immediately sending SIGKILL
- Allow startup time before health checks fail
- Capture stdout and stderr without logging secrets

Health check:

```bash
curl --fail https://api.example.com/api/health
```

Only route traffic after the endpoint succeeds and `dataStore.status` is `operational`.

### 9. Same-origin Nginx example

This example serves static Web and API from one origin. `/api/` carries SSE, so proxy buffering must be disabled and the read timeout extended.

```nginx
server {
  listen 443 ssl http2;
  server_name app.example.com;

  root /srv/siteforge/apps/web/dist;
  index index.html;

  location /api/ {
    proxy_pass http://127.0.0.1:8787;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_buffering off;
    proxy_read_timeout 300s;
  }

  location /s/ {
    proxy_pass http://127.0.0.1:8787;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  location /site/ {
    proxy_pass http://127.0.0.1:8787;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  location / {
    try_files $uri $uri/ /index.html;
  }
}
```

In same-origin mode, leave `VITE_API_BASE_URL` empty and set:

```env
CORS_ORIGINS=https://app.example.com
PUBLIC_BASE_URL=https://app.example.com
```

### 10. Separate frontend and API domains

Frontend build:

```bash
VITE_API_BASE_URL=https://api.example.com pnpm --filter web build
```

Server:

```env
CORS_ORIGINS=https://app.example.com
PUBLIC_BASE_URL=https://api.example.com
```

Requirements:

- Both domains use HTTPS.
- CORS lists exact trusted origins; credentialed requests must not use `*`.
- A CDN or proxy must not buffer SSE.
- `/s/:id` and `/site/:slug` must be publicly reachable through `PUBLIC_BASE_URL`.

### 11. S3-compatible publishing

When all values are present, the publishing adapter replaces local `PUBLISH_STORAGE_DIR`:

```env
S3_ENDPOINT=https://<account>.r2.cloudflarestorage.com
S3_REGION=auto
S3_BUCKET=siteforge-sites
S3_ACCESS_KEY_ID=<replace-me>
S3_SECRET_ACCESS_KEY=<replace-me>
S3_PUBLIC_BASE_URL=https://sites.example.com
```

AWS S3, Cloudflare R2, MinIO, and compatible path-style APIs are supported. Object key:

```text
sites/<slug>/index.html
```

Optional CDN invalidation:

```env
CDN_INVALIDATION_WEBHOOK_URL=https://cdn.example.com/invalidate
CDN_INVALIDATION_WEBHOOK_TOKEN=<replace-me>
```

Grant object-storage credentials only the minimum read/write permissions required for the target bucket.

### 12. Vercel and PR Preview

`.github/workflows/preview.yml` builds the frontend for every pull request and always uploads `apps/web/dist` as an artifact. It also creates a Vercel Preview when these secrets are configured:

```text
VERCEL_TOKEN
VERCEL_ORG_ID
VERCEL_PROJECT_ID
```

Repository variable:

```text
PREVIEW_API_BASE_URL
```

It supplies the Preview backend URL at build time. Without Vercel secrets, the workflow should still succeed and only retain the build artifact.

Production Web can also run on Vercel, but Hono Server, MySQL, and persistent directories must run in a separate Node.js environment.

### 13. Email webhook contract

The server sends:

```json
{
  "to": "user@example.com",
  "template": "siteforge-login-code",
  "code": "123456",
  "expiresInMinutes": 10
}
```

The mail service should:

- Validate the Bearer token or source network
- Avoid logging the full code
- Apply rate limits and retry policy
- Return a non-2xx status for permanent failure so SiteForge can report delivery failure clearly

### 14. Security checks

Production must verify:

- `AUTH_JWT_SECRET` is replaced and stored securely
- `ALLOW_PRIVATE_PROVIDER_BASE_URLS=false`
- `CORS_ORIGINS` contains no untrusted domains
- End-to-end HTTPS is enabled
- The proxy preserves the correct `X-Forwarded-Proto`
- Logs contain no API keys, JWTs, refresh tokens, verification codes, or email tokens
- File and object storage do not allow directory listing
- The MySQL account has only the required privileges for the target database
- CSP, Referrer-Policy, and `nosniff` headers on share/publish pages are not overwritten by the proxy

### 15. Pre-release verification

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm --filter web e2e:browser
pnpm --filter web e2e:visual
pnpm --filter server db:mysql:check
```

Business smoke tests:

1. `/api/health` succeeds.
2. Request a code and complete login.
3. Open a starter project and edit/export it.
4. Create a cloud project and an immutable new version.
5. Create and delete a temporary share.
6. Publish, republish, and unpublish a site.
7. Confirm the admin console reports the expected storage driver, schema, revision, and latency.
8. With a real model, verify first token, complete response, and cancellation behavior.

### 16. Monitoring and alerts

Monitor at least:

- `/api/health` availability and P95 latency
- Server restarts and unhandled exceptions
- MySQL errors, pool exhaustion, stalled revision, and checksum mismatches
- Verification-email failure rate and invalid-attempt count
- Provider error categories, first-token latency, total generation time, and SSE disconnect rate
- Monthly quota reservation, successful commit, and failed-request refund
- Share, publish, and object-storage 4xx/5xx errors
- CDN invalidation webhook failures
- Disk and persistent-volume capacity

Alerts and event records must not contain API keys or full user prompts.

### 17. Backups

File mode:

- Snapshot `DATA_STORAGE_FILE` regularly
- Back up share and publish directories together
- Copy only from a consistent state or stop writes first

MySQL:

```bash
pnpm --filter server db:mysql:export -- --output=/backup/siteforge-rollback.json
```

Also use the database provider's physical or logical backups. The JSON export is an application-level rollback bridge, not a replacement for database backups.

S3:

- Enable bucket versioning or a lifecycle policy
- Periodically verify public-domain and object permissions
- Do not immediately hard-delete historical objects when application records are removed unless the retention policy allows it

### 18. Rollback

#### 18.1 Application version

- Roll the frontend back to the previous immutable build or Vercel Deployment.
- Roll Server back to the previous image/build.
- Never delete persistent volumes, databases, or buckets as part of an application rollback.

#### 18.2 MySQL → file mode

1. Stop write traffic or scale Server to zero.
2. Run `db:mysql:export`.
3. Set `DATA_STORAGE_DRIVER=file`.
4. Point `DATA_STORAGE_FILE` to the exported JSON.
5. Start one Server instance.
6. Complete health and business smoke tests.
7. Restore traffic.

Database changes must remain readable by the previous application version or provide a separately tested reverse migration.

### 19. Go-live checklist

- [ ] Frontend built with the correct `VITE_API_BASE_URL`
- [ ] Server uses Node.js 24
- [ ] All secrets come from a secret manager
- [ ] MySQL migrations applied in order
- [ ] `db:mysql:check` passes
- [ ] File directories are on persistent volumes, or MySQL + S3 is configured
- [ ] CORS and `PUBLIC_BASE_URL` are correct
- [ ] Email webhook works
- [ ] SSE is not buffered by the proxy
- [ ] Health checks, monitoring, and alerts are configured
- [ ] Backup and restore have been rehearsed
- [ ] Lint, typecheck, tests, Axe, and visual regression all pass
