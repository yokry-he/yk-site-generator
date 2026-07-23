# SiteForge · yk-site-generator

![CI](https://github.com/yokry-he/yk-site-generator/actions/workflows/ci.yml/badge.svg)

一句话描述需求,AI 帮你生成、迭代、编辑、导出并发布完整网站。仓库采用 pnpm monorepo,覆盖 14 类站点、多模型 SSE 生成、官方模板、品牌套件、版本历史、发布管理与运营质量闭环。

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
- 生成耗时、模型、站点类型、输出长度、解析结果与错误分类可观测事件

### 云端工作区

- 邮箱验证码登录、短期访问令牌、HttpOnly 刷新令牌轮换和会话撤销
- 本地历史主动迁移为云端项目,保留全部迭代轮次
- 项目 CRUD、不可变版本快照、明确版本 URL、预览和回滚
- 可视化编辑器:点选文案、图片、链接、品牌色、背景、字体、撤销重做
- 品牌套件:Logo、颜色、字体、圆角、按钮、阴影、实时多设备预览与可读性检查
- 品牌套件云端 CRUD、默认套件与跨项目复用;应用时创建不可变新版本
- 月度生成额度、使用记录、失败请求自动退回
- 一键发布、下线、重新发布,支持本地目录或 S3 兼容对象存储

### 官方模板中心

- 12 套首批官方模板,覆盖 SaaS、企业官网、作品集、内容、活动、餐饮、电商、课程、文档、社区、数据大屏和个人主页
- 目录搜索、分类/行业/风格筛选、收藏与精选排序
- 真实响应式 iframe 预览,支持桌面、平板和手机尺寸
- 快速变量定制与品牌套件实时联动
- 模板创建云端项目并保存为不可变首版
- 模板来源写入项目元数据,便于后续质量与转化分析

### 模板引擎

- `$M{path.to.value}` 变量替换
- `$M{if condition}` / `$M{else}` / `$M{endif}` 可嵌套条件块
- 布尔开关表单、变量即时预览、旧模板语法兼容
- ZIP 文件树和二进制资源保留

### 新手引导与质量反馈

- 目标 → 站点类型 → 创建起点 → 品牌顺序的结果导向引导
- 每一步服务端保存,支持跨设备恢复、跳过、重置和重新打开
- 启动清单自动识别品牌套件、项目和发布站点是否完成
- 项目版本轻量反馈入口,支持正向/负向、问题分类和补充说明
- 同一用户和版本幂等更新反馈,避免重复数据
- 反馈关联项目版本、模型和站点类型,由服务端校验资源归属

### 管理后台与可观测性

- 实时角色与账号状态校验,权限不缓存到 JWT
- 用户搜索、角色调整、账号限制与会话立即撤销
- 防止管理员误锁自己或降低自身权限
- 运营概览:用户、项目、发布、模板、品牌、用量、错误和慢请求
- 审计日志:操作者、目标资源、请求 ID、IP、User-Agent、前后状态和结果
- 系统事件:HTTP 错误、慢请求、生成成功、解析失败和厂商错误
- 质量反馈工作区:负向率、待处理队列、高频问题、模型/站点类型筛选和处理状态
- 基础设施状态:API、数据存储、邮件、对象存储和 MySQL 适配状态

## 目录结构

```text
yk-site-generator/
├── apps/
│   ├── web/                 # Vue 3 + TypeScript + Vite + Vue Router + Tailwind
│   └── server/              # Hono API、认证、项目、品牌、模板、反馈、管理、分享与发布
├── packages/
│   ├── shared/              # 产物协议、解析器、SEO、品牌 Token 与官方模板渲染器
│   └── prompts/             # 14 类提示词、迭代提示词与质量评测
├── deploy/                  # PR 预览与生产部署说明
├── apps/server/db/          # MySQL 8 基线结构、增量 migration 与事务状态表
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

开发环境可通过 `ADMIN_EMAILS` 指定管理员邮箱。该邮箱首次登录后获得管理员角色:

```bash
ADMIN_EMAILS=admin@example.com
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

Draft PR 的 CI 会执行 frozen-lockfile 安装、lint、严格类型检查、全仓构建、全仓单测与生成链路 E2E。失败日志会作为 7 天工件保留。

## 数据存储

### 文件适配器

开发和单实例环境默认使用原子 JSON 文件:

```env
DATA_STORAGE_DRIVER=file
DATA_STORAGE_FILE=.data/siteforge.json
```

写入采用进程内串行队列、临时文件和原子重命名。临时分享与本地发布目录仍需要挂载持久卷。

### MySQL 事务适配器

正式多实例环境可切换到 MySQL 8:

```env
DATA_STORAGE_DRIVER=mysql
MYSQL_URL=mysql://siteforge:password@127.0.0.1:3306/siteforge
MYSQL_CONNECTION_LIMIT=10
MYSQL_SSL_MODE=required
```

当前第一阶段使用版本化应用快照作为事务迁移桥梁:

- `SELECT ... FOR UPDATE` 保证跨实例写入串行化
- 每次提交递增 revision
- SHA-256 校验和检测数据损坏
- 服务启动前验证连接与表结构
- SIGTERM / SIGINT 时优雅关闭连接池
- 现有业务 API 与文件适配器保持一致

数据库先执行 `apps/server/db/001_initial.sql` 及后续编号 migration,事务快照表位于 `004_transactional_state.sql`。

连接与 Schema 检查:

```bash
MYSQL_URL='mysql://...' pnpm --filter server db:mysql:check
```

JSON → MySQL 迁移预检:

```bash
MYSQL_URL='mysql://...' pnpm --filter server db:mysql:import -- --dry-run
```

首次导入:

```bash
MYSQL_URL='mysql://...' pnpm --filter server db:mysql:import -- --file=.data/siteforge.json
```

MySQL 已有数据时默认拒绝覆盖。明确使用 `--force` 前,命令会自动导出覆盖前快照:

```bash
MYSQL_URL='mysql://...' pnpm --filter server db:mysql:import -- --force
```

独立导出可用于回滚到文件适配器:

```bash
MYSQL_URL='mysql://...' pnpm --filter server db:mysql:export -- --output=.data/mysql-rollback.json
```

然后将 `DATA_STORAGE_DRIVER=file`、`DATA_STORAGE_FILE=.data/mysql-rollback.json` 后重启即可回滚。

MySQL 基线还覆盖用户、会话、项目、版本、额度、发布、品牌、模板、反馈、引导、审计与系统事件的规范化表。后续会在不改变业务 API 的前提下逐域从事务快照迁移至规范化仓库。

## 发布存储

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
- 账号限制会立即撤销全部活跃会话
- 管理员权限每次从服务端数据源读取,角色变化立即生效
- MySQL 迁移默认禁止覆盖已有快照,强制覆盖前自动生成回滚文件
- 每个 MySQL 快照都校验 SHA-256,不匹配时拒绝读取
- 临时分享使用随机 ID 与独立删除令牌,最多保留 7 天
- 分享与发布页面包含 CSP、Referrer-Policy、nosniff 等隔离头
- 品牌 Logo 仅接受受支持图片类型并限制体积
- 模板变量在服务端渲染前裁剪并进行 HTML 转义
- 反馈只能关联当前登录用户拥有的项目版本
- 生成事件不记录 API Key 或用户原始需求全文
- 生成产物可能包含第三方内容,正式上线前仍需人工审核

## 阶段进度

- [x] P0 工程骨架与严格 CI
- [x] P1 真实生成、迭代、本地历史、SEO、ZIP 和临时分享
- [x] P2 核心账号、项目版本、模板条件、可视化编辑、发布和额度能力
- [x] 品牌套件与主题编辑器第一阶段
- [x] 官方模板中心第一阶段
- [x] 管理后台、审计日志与可观测性第一阶段
- [x] 新手引导与质量反馈闭环第一阶段
- [x] MySQL 8 Schema、事务适配器、JSON 迁移与回滚工具
- [ ] 规范化 MySQL 领域仓库与双写迁移
- [ ] 管理后台模板运营、功能开关与更细粒度权限
- [ ] 生产邮件、对象存储、CDN 与正式域名接入
- [ ] 表单线索、访问统计、套餐与支付
