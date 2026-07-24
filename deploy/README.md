# SiteForge 部署入口 / Deployment Entry Point

[中文](#中文) · [English](#english)

完整的生产部署、MySQL、Nginx、S3、监控、备份和回滚说明位于：

The complete production, MySQL, Nginx, S3, monitoring, backup, and rollback guide is available at:

- [`../docs/DEPLOYMENT.md`](../docs/DEPLOYMENT.md)

---

## 中文

### PR 前端预览

`.github/workflows/preview.yml` 会在每个 Pull Request 上构建 `apps/web`，并上传 `apps/web/dist` 工件。

配置以下 GitHub Actions Secrets 后，工作流还会部署 Vercel Preview：

```text
VERCEL_TOKEN
VERCEL_ORG_ID
VERCEL_PROJECT_ID
```

仓库变量：

```text
PREVIEW_API_BASE_URL
```

它会在构建时作为预览环境的 API 地址注入前端。未配置 Vercel Secrets 时，工作流仍应成功，只保留静态构建工件。

### 预览环境最低要求

- Preview API 必须通过 HTTPS 访问。
- `PREVIEW_API_BASE_URL` 不要以 `/` 结尾。
- API 的 `CORS_ORIGINS` 必须包含 Vercel Preview Origin，或由受控的 Preview 域名策略生成允许列表。
- 代理不能缓冲 `/api/generate` 的 SSE 响应。
- Preview 环境不得使用生产数据库、生产邮件 Token 或生产对象存储写权限。

### 生产环境入口

生产部署前依次阅读：

1. [`../docs/DEVELOPMENT.md`](../docs/DEVELOPMENT.md)：构建、测试和环境变量基础
2. [`../docs/DEPLOYMENT.md`](../docs/DEPLOYMENT.md)：拓扑、Migration、反向代理、对象存储、监控和回滚
3. [`../docs/SECURITY_ABUSE.md`](../docs/SECURITY_ABUSE.md)：自定义 Provider、上传资源和账号隔离安全边界

---

## English

### Pull request frontend previews

`.github/workflows/preview.yml` builds `apps/web` for every pull request and uploads the `apps/web/dist` artifact.

When the following GitHub Actions secrets are configured, the workflow also creates a Vercel Preview:

```text
VERCEL_TOKEN
VERCEL_ORG_ID
VERCEL_PROJECT_ID
```

Repository variable:

```text
PREVIEW_API_BASE_URL
```

It is injected at build time as the API URL for the preview frontend. Without Vercel secrets, the workflow should still succeed and retain only the static build artifact.

### Minimum preview-environment requirements

- The Preview API must be served over HTTPS.
- `PREVIEW_API_BASE_URL` should not end with `/`.
- API `CORS_ORIGINS` must include the Vercel Preview origin, or a controlled preview-domain policy must generate the allowlist.
- Proxies must not buffer SSE responses from `/api/generate`.
- Preview environments must not use the production database, production email token, or production object-storage write credentials.

### Production entry point

Read these documents before production deployment:

1. [`../docs/DEVELOPMENT.md`](../docs/DEVELOPMENT.md): build, testing, and environment-variable foundations
2. [`../docs/DEPLOYMENT.md`](../docs/DEPLOYMENT.md): topology, migrations, reverse proxy, object storage, monitoring, and rollback
3. [`../docs/SECURITY_ABUSE.md`](../docs/SECURITY_ABUSE.md): custom-provider, uploaded-asset, and tenant-isolation boundaries
