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
DATA_STORAGE_FILE=/data/siteforge/siteforge.json
SHARE_STORAGE_DIR=/data/siteforge/shares
PUBLISH_STORAGE_DIR=/data/siteforge/published
```

三个路径都必须挂载持久卷。文件数据仓库使用进程内串行队列和原子 rename 防止同一实例内并发写损坏,但不适合多个服务实例共享写入。

### 正式数据库

`apps/server/db/001_initial.sql` 提供用户、验证码、会话、项目、不可变版本、用量和发布记录的 PostgreSQL 基线结构。多实例正式部署应将 `data-store.ts` 替换为数据库适配器,并保持现有路由返回结构不变。

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
9. 请求 `/api/health`
10. 完成一次验证码登录、项目版本新增、回滚、发布和下线
11. 创建临时分享并确认 `/s/:id`、过期页和删除令牌正常
12. 核对 CORS、Cookie Secure/SameSite、CSP 和日志脱敏

## 监控建议

- `/api/health` 成功率和响应时间
- 登录验证码发送失败率与错误尝试次数
- 模型厂商错误分类、生成延迟和 SSE 中断率
- 月度额度预占与退回数量
- 分享/发布写入失败和对象存储 4xx/5xx
- 数据文件或数据库备份、恢复演练

## 回滚

前端使用 Vercel 上一个成功 Deployment 回滚。服务端保持镜像/构建版本不可变;回滚服务版本时不要删除数据持久卷或对象存储。数据库结构变更必须提供向后兼容读取或独立迁移/回滚脚本。
