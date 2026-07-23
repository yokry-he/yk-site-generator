# SiteForge 部署与预览

## PR 前端预览

`.github/workflows/preview.yml` 会在每个 Pull Request 上执行前端构建并保留 7 天构建产物。配置以下 Secrets 后,工作流会自动部署到 Vercel 并把链接写回 PR:

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

仓库变量 `PREVIEW_API_BASE_URL` 用于构建时注入预览环境的 Hono 服务地址。未配置 Vercel Secrets 时,工作流只上传 `apps/web/dist` 工件,不会失败。

## 服务端最低配置

Hono 服务需要 Node.js 24+。生产环境至少配置:

```env
NODE_ENV=production
PORT=8787
CORS_ORIGINS=https://preview.example.com,https://app.example.com
PUBLIC_BASE_URL=https://api.example.com
AUTH_JWT_SECRET=<随机生成的 32+ 字符密钥>
EMAIL_WEBHOOK_URL=https://mailer.example.com/send
EMAIL_WEBHOOK_TOKEN=<邮件服务令牌>
MONTHLY_GENERATION_LIMIT=100
```

### 单实例文件模式

适合内测或单实例 MVP:

```env
DATA_STORAGE_DRIVER=file
DATA_STORAGE_FILE=/data/siteforge/siteforge.json
SHARE_STORAGE_DIR=/data/siteforge/shares
PUBLISH_STORAGE_DIR=/data/siteforge/published
```

三个路径都必须挂载持久卷。文件数据仓库使用进程内串行队列和原子 rename 防止同一实例内并发写损坏,但不适合多个服务实例共享写入。

### MySQL 8 多实例模式

正式多实例部署使用:

```env
DATA_STORAGE_DRIVER=mysql
MYSQL_URL=mysql://siteforge:<password>@mysql.internal:3306/siteforge
MYSQL_CONNECTION_LIMIT=10
MYSQL_SSL_MODE=required
MYSQL_CONNECT_TIMEOUT_MS=10000
```

按顺序执行 `apps/server/db/001_initial.sql` 以及后续编号 migration。`004_transactional_state.sql` 提供当前事务快照表。服务启动前会验证 MySQL 连接和表结构,失败时拒绝监听端口。

迁移建议严格遵循以下顺序:

1. 对现有 JSON 文件做独立备份。
2. 执行 `db:mysql:check` 验证连接、TLS 和表结构。
3. 执行 `db:mysql:import -- --dry-run` 查看来源计数、校验和和目标状态。
4. 首次导入且目标为空时执行 `db:mysql:import`。
5. 重新执行 `db:mysql:check`,记录 revision 与 checksum。
6. 将服务配置切换为 `DATA_STORAGE_DRIVER=mysql`。
7. 单实例启动并完成登录、项目、发布等冒烟测试。
8. 再扩容至多个实例。

```bash
MYSQL_URL='mysql://...' pnpm --filter server db:mysql:check
MYSQL_URL='mysql://...' pnpm --filter server db:mysql:import -- --dry-run
MYSQL_URL='mysql://...' pnpm --filter server db:mysql:import -- --file=/data/siteforge/siteforge.json
```

目标 MySQL 已存在快照时命令默认拒绝覆盖。明确使用 `--force` 时,覆盖前会自动生成 JSON 回滚快照。不要在多个应用实例仍持续写入时执行强制导入。

独立备份:

```bash
MYSQL_URL='mysql://...' pnpm --filter server db:mysql:export -- --output=/backup/siteforge-rollback.json
```

当前 MySQL 事务桥梁使用:

- InnoDB 事务
- `SELECT ... FOR UPDATE` 跨实例写锁
- 单调递增 revision
- SHA-256 payload 校验和
- 连接池和优雅关闭

规范化领域表已经在 MySQL 基线中定义,后续可在保持 API 不变的情况下逐域迁移。

## S3 兼容发布

完整配置以下四项时,发布适配器自动从本地目录切换到 S3 path-style API:

```env
S3_ENDPOINT=https://<account>.r2.cloudflarestorage.com
S3_REGION=auto
S3_BUCKET=siteforge-sites
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
S3_PUBLIC_BASE_URL=https://sites.example.com
```

适用于 AWS S3、Cloudflare R2、MinIO 和提供 S3 兼容接口的对象存储。站点对象路径为:

```text
sites/<slug>/index.html
```

可选 CDN 缓存失效:

```env
CDN_INVALIDATION_WEBHOOK_URL=https://cdn.example.com/invalidate
CDN_INVALIDATION_WEBHOOK_TOKEN=...
```

Webhook 请求体:

```json
{
  "action": "publish",
  "paths": ["/sites/example/index.html", "/site/example"]
}
```

## 邮件验证码 Webhook

生产环境没有配置 `EMAIL_WEBHOOK_URL` 时,验证码接口会明确失败,不会把验证码返回给浏览器。Webhook 收到:

```json
{
  "to": "user@example.com",
  "template": "siteforge-login-code",
  "code": "123456",
  "expiresInMinutes": 10
}
```

邮件服务应避免记录完整验证码,并对来源 IP 或 Bearer Token 做限制。

## 前后端分域

前端构建变量:

```env
VITE_API_BASE_URL=https://api.example.com
```

服务端 `CORS_ORIGINS` 必须包含前端完整 origin,并允许凭据。`PUBLIC_BASE_URL` 指向能够访问 `/s/:id` 与 `/site/:slug` 的公开服务地址。

## 发布前检查

1. `pnpm install --frozen-lockfile`
2. `pnpm lint`
3. `pnpm typecheck`
4. `pnpm build`
5. `pnpm test`
6. `pnpm --filter web e2e`
7. `pnpm --filter web e2e:iterate`
8. `pnpm --filter web e2e:history`
9. MySQL 模式执行 `db:mysql:check`
10. 请求 `/api/health`,确认 `dataStore.status=operational`
11. 管理后台确认数据驱动、Schema、revision 和延迟正确
12. 完成一次验证码登录、项目版本新增、回滚、发布和下线
13. 创建临时分享并确认 `/s/:id`、过期页和删除令牌正常
14. 核对 CORS、Cookie Secure/SameSite、CSP 和日志脱敏

## 监控建议

- `/api/health` 成功率、数据驱动状态和响应时间
- MySQL 连接池错误、revision 停滞和 checksum 不匹配
- 登录验证码发送失败率与错误尝试次数
- 模型厂商错误分类、生成延迟和 SSE 中断率
- 月度额度预占与退回数量
- 分享/发布写入失败和对象存储 4xx/5xx
- 数据库定期导出与恢复演练

## 回滚

前端使用 Vercel 上一个成功 Deployment 回滚。服务端保持镜像/构建版本不可变。

MySQL → 文件回滚流程:

1. 停止写流量或缩容至零。
2. 执行 `db:mysql:export` 导出当前一致快照。
3. 配置 `DATA_STORAGE_DRIVER=file`。
4. 将 `DATA_STORAGE_FILE` 指向导出的 JSON。
5. 启动单实例并完成健康和业务冒烟测试。
6. 确认数据后恢复流量。

回滚服务版本时不要删除数据持久卷、MySQL 数据库或对象存储。数据库结构变更必须保持向后兼容读取或提供独立迁移脚本。
