# yk-site-generator

![CI](https://github.com/yokry-he/yk-site-generator/actions/workflows/ci.yml/badge.svg)

一句话描述需求,AI 帮你生成完整网站。SiteForge 产品(个人主页、企业官网、文档站、数据大屏等 14 种站点类型)的正式工程仓库,pnpm monorepo。

- 任务看板(P0 阶段):https://github.com/yokry-he/yk-site-generator/issues/1
- 产品规划文档:`docs/`(本地工作区,未入库)

## 目录结构

```
yk-site-generator/
├── apps/
│   ├── web/        # 前端:Vue 3.5 + TS + Vite + Vue Router + Tailwind(从 siteforge-vue 迁移)
│   └── server/     # 服务端:Hono(Node.js,TS),生成代理 / 厂商测连 API(P1 实现)
├── packages/
│   └── shared/     # TS 共享包:生成产物协议类型(ArtifactFileTree 等,SF-1-1 占位)
└── .github/workflows/ci.yml
```

## 开发命令

```bash
pnpm install        # 安装全部依赖
pnpm dev            # 并行启动 web(vite)与 server(tsx watch)
pnpm build          # 全部包构建(web: vue-tsc+vite;server: tsup;shared: tsc)
pnpm typecheck      # 全部包类型检查
pnpm lint           # 配置了 lint 的包执行 lint
pnpm test           # server 的 vitest
```

### apps/server

```bash
cp apps/server/.env.example apps/server/.env   # 可选,默认值即可运行
pnpm --filter server dev                        # http://localhost:8787
curl http://localhost:8787/api/health           # { ok: true, service: "yk-site-generator", time }
```

统一错误格式:`{ "error": { "code": "...", "message": "..." } }`(404 / 500 / 业务错误一致)。

## 部署(待办)

预览/生产部署需要外部平台账号与 secrets,尚未配置。待用户在仓库 Settings → Secrets and variables → Actions 中配置后补充对应 workflow:

| 平台 | 需要的 secrets |
| --- | --- |
| Vercel(web) | `VERCEL_TOKEN`、`VERCEL_ORG_ID`、`VERCEL_PROJECT_ID` |
| Netlify(web) | `NETLIFY_AUTH_TOKEN`、`NETLIFY_SITE_ID` |
| 服务端托管(Render/Railway/Fly 等) | 视平台而定,如 `RENDER_API_KEY` / `FLY_API_TOKEN` |

server 生产环境还需配置环境变量:`PORT`、`NODE_ENV=production`、`CORS_ORIGINS`(前端正式域名)。

## 阶段进度

- [x] SF-0-1 pnpm monorepo(apps/web + apps/server + packages/shared)
- [x] SF-0-2 Hono 服务端骨架(health / 统一错误 / 日志 / zod env / CORS / vitest)
- [x] SF-0-3 CI(lint + typecheck + build + test)
- [ ] P1 MVP:真实生成链路(见规划文档)
