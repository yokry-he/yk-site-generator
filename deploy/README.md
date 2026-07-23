# SiteForge 部署与预览

## PR 前端预览

`.github/workflows/preview.yml` 会在每个 Pull Request 上执行前端构建并保留 7 天构建产物。配置以下 Secrets 后,工作流还会自动部署到 Vercel 并把链接写回 PR:

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

仓库变量 `PREVIEW_API_BASE_URL` 用于构建时注入预览环境的 Hono 服务地址,例如 `https://siteforge-api-preview.example.com`。未配置 Vercel Secrets 时,工作流只上传 `apps/web/dist` 工件,不会失败。

## 服务端部署要求

Hono 服务需要 Node.js 24+ 与可写持久目录。至少配置:

```env
NODE_ENV=production
PORT=8787
CORS_ORIGINS=https://preview.example.com,https://app.example.com
PUBLIC_BASE_URL=https://api.example.com
SHARE_STORAGE_DIR=/data/siteforge/shares
SHARE_TTL_DAYS=7
MAX_SHARE_BYTES=2097152
```

`SHARE_STORAGE_DIR` 必须挂载持久卷,否则实例重启后临时分享会丢失。多实例部署时应把临时分享存储替换为共享对象存储或数据库;当前文件适配器适用于单实例 MVP。

## 前后端分域

前端构建变量:

```env
VITE_API_BASE_URL=https://api.example.com
```

服务端 `CORS_ORIGINS` 必须包含前端完整 origin。`PUBLIC_BASE_URL` 应指向可以访问 `/s/:id` 的服务端公开地址,以便生成正确的分享链接。

## 发布前检查

1. `pnpm install --frozen-lockfile`
2. `pnpm lint`
3. `pnpm typecheck`
4. `pnpm build`
5. `pnpm test`
6. `pnpm --filter web e2e:history`
7. 请求 `/api/health`
8. 创建临时分享并确认 `/s/:id` 可访问、过期页和删除令牌正常
9. 核对 CORS、CSP、日志中不包含 API Key 或会话令牌

## 回滚

前端使用 Vercel 上一个成功 Deployment 回滚。服务端保持镜像/构建版本不可变,回滚到上一个版本后不要删除持久卷。涉及数据结构变更时,必须先提供向后兼容读取或独立迁移脚本。
