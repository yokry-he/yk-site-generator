# SiteForge · yk-site-generator

![CI](https://github.com/yokry-he/yk-site-generator/actions/workflows/ci.yml/badge.svg)

一句话描述需求,AI 帮你生成、迭代、编辑、导出并发布完整网站。仓库采用 pnpm monorepo,覆盖 14 类站点、多模型 SSE 生成、模板引擎、版本历史和发布管理。

- 任务总览:Issue #1
- 当前开发分支:`agent/continue-development-20260723`
- 当前集成 PR:Draft PR #26(开发期间不合并到 `main`)

## 已实现能力

### 生成与产物

- OpenAI 兼容、Anthropic、Gemini 多厂商流式适配
- SSE 逐 token 输出、增量 iframe 预览、停止与错误分类
- 自包含单 HTML / 文件树互转与稳定 round-trip
- SEO、Open Graph、Twitter Card、charset、viewport 自动注入与完整性评测
- 对话式多轮迭代、任意轮预览和回到历史版本
- IndexedDB 本地生成历史、导入导出、容量保护
- 真实产物 ZIP 导出与 7 天临时分享

### 云端工作区

- 邮箱验证码登录、短期访问令牌、HttpOnly 刷新令牌轮换和会话撤销
- 本地历史主动迁移为云端项目,保留全部迭代轮次
- 项目 CRUD、不可变版本快照、预览和回滚
- 可视化编辑器:点选文案、图片、链接、品牌色、背景、字体、撤销重做
- 月度生成额度、使用记录、失败请求自动退回
- 一键发布、下线、重新发布,支持本地目录或 S3 兼容对象存储

### 模板

- `$M{path.to.value}` 变量替换
- `$M{if condition}` / `$M{else}` / `$M{endif}` 可嵌套条件块
- 布尔开关表单、变量即时预览、旧模板语法兼容
- ZIP 文件树和二进制资源保留

## 目录结构

```text
yk-site-generator/
├── apps/
│   ├── web/                 # Vue 3 + TypeScript + Vite + Vue Router + Tailwind
│   └── server/              # Hono(Node.js) API、认证、项目、额度、分享与发布
├── packages/
│   ├── shared/              # 产物协议、解析器、SEO 注入与完整性检查
│   └── prompts/             # 14 类提示词、迭代提示词与质量评测
├── deploy/                  # PR 预览与生产部署说明
├── apps/server/db/          # PostgreSQL 正式环境基线结构
└── .github/workflows/       # CI 与可选 Vercel Preview
```

## 本地开发

要求 Node.js 24+、pnpm 11+。

```bash
pnpm install
cp apps/server/.env.example apps/server/.env
pnpm dev
```

默认地址:

- Web:`http://localhost:5173`
- API:`http://localhost:8787`
- 健康检查:`http://localhost:8787/api/health`

Vite 会代理 `/api`、`/s` 与 `/site` 到本地 Hono 服务。需要修改目标时设置:

```bash
VITE_DEV_SERVER_TARGET=http://localhost:8787 pnpm --filter web dev
```

## 质量检查

```bash
pnpm lint
pnpm typecheck
pnpm build
pnpm test
pnpm --filter web e2e
pnpm --filter web e2e:iterate
pnpm --filter web e2e:history
pnpm --filter prompts eval -- --dry-run
```

Draft PR 的 CI 会执行 lint、严格类型检查、全仓构建、全仓单测与三条生成链路 E2E。失败日志会作为 7 天工件保留。

## 数据与部署边界

开发和单实例 MVP 使用原子 JSON 文件适配器,配置 `DATA_STORAGE_FILE`;临时分享和本地发布目录必须挂载持久卷。正式多实例部署建议按 `apps/server/db/001_initial.sql` 迁移 PostgreSQL,并将数据仓库替换为数据库适配器。

发布存储优先级:

1. S3 配置完整时使用 S3 兼容对象存储
2. 未配置时使用 `PUBLISH_STORAGE_DIR` 本地目录

支持 MinIO、Cloudflare R2、AWS S3、阿里云 OSS 等具备 S3 兼容接口的服务。CDN 缓存失效可通过 Webhook 接入。

PR Preview 始终构建并上传前端产物;配置 Vercel Secrets 后自动部署并回写 PR 链接。完整配置与回滚流程见 `deploy/README.md`。

## 安全约束

- 用户模型 API Key 仅随请求传输,服务端不持久化、不写日志
- 生产环境必须配置独立 `AUTH_JWT_SECRET`
- 验证码有发送频率、有效期和错误次数限制
- 访问令牌短期有效,刷新令牌只保存哈希并支持轮换、撤销
- 临时分享使用随机 ID 与独立删除令牌,最多保留 7 天
- 分享与发布页面包含 CSP、Referrer-Policy、nosniff 等隔离头
- 生成产物可能包含第三方内容,正式上线前仍需人工审核

## 阶段进度

- [x] P0 工程骨架与严格 CI
- [x] P1 真实生成、迭代、本地历史、SEO、ZIP 和临时分享
- [x] P2 核心账号、项目版本、模板条件、可视化编辑、发布和额度能力
- [ ] 外部基础设施接入:生产数据库、邮件服务、对象存储、CDN、正式域名
- [ ] P3 模板市场、自定义域名、支付订阅、主题云同步与访问统计
