# 在线预览、部署与发布门禁 / Online Preview, Deployment, and Release Gates

[中文](#中文) · [English](#english)

## 中文

`POST /api/delivery/previews` 从指定工程版本创建不可变快照。预览链接使用 18 字节随机 slug，默认有效期 24 小时，每个用户／项目最多保留 10 个活动预览。预览响应使用 CSP sandbox、nosniff 和 no-referrer。生产环境应设置 `PREVIEW_PUBLIC_BASE_URL`，把预览放在不携带主站 Cookie 的独立域名。

Production 部署要求 docs、unit、typecheck、build、database、browser、accessibility、visual 和 five-stack 全部为 `passed + trusted`。证据通过交付 API 导入，只有 `X-Release-Gate-Token` 与 `RELEASE_GATE_TOKEN` 常量时间匹配且来源不是 manual 时才可信。手动 UI 标记不能解锁生产部署。

部署默认 `DEPLOYMENT_DRIVER=disabled`。Webhook 驱动要求 `DEPLOYMENT_WEBHOOK_URL` 和至少 32 字节的 `DEPLOYMENT_WEBHOOK_SECRET`，请求体使用 HMAC-SHA256 签名。Staging 可在门禁未完全通过时启动，Production 不可以。`/projects/:id/delivery` 提供版本选择、Runner、在线预览、门禁、部署和历史记录。

## English

`POST /api/delivery/previews` snapshots an immutable engineering version. Links use 18 random bytes, expire after 24 hours by default, and retain at most ten active previews per user/project. Preview responses use a sandboxed CSP, nosniff, and no-referrer. Production installations should use `PREVIEW_PUBLIC_BASE_URL` on a separate origin without SiteForge cookies.

Production deployment requires trusted passing evidence for docs, unit tests, typechecking, build, database integration, browser tests, accessibility, visual regression, and the five-stack matrix. Evidence is trusted only when the release-gate token matches in constant time and the source is not manual.

Deployment defaults to disabled. The webhook driver requires a URL and a non-placeholder secret of at least 32 bytes; payloads are signed with HMAC-SHA256. Staging can start before every gate passes, Production cannot. `/projects/:id/delivery` exposes versions, runner actions, previews, gates, deployments, and history.
