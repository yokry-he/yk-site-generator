# SiteForge · yk-site-generator

![CI](https://github.com/yokry-he/yk-site-generator/actions/workflows/ci.yml/badge.svg)

一句话描述需求，AI 帮你生成、迭代、编辑、统一品牌、导出并发布完整网站。仓库采用 pnpm monorepo，覆盖 14 类站点、多模型 SSE 生成、官方模板、品牌套件、云端版本、发布管理和运营质量闭环。

- 任务总览：Issue #1
- 当前开发分支：`agent/continue-development-20260723`
- 当前集成 PR：Draft PR #26，开发期间不合并到 `main`

## 已实现能力

### 生成与产物

- OpenAI 兼容、Anthropic、Gemini 多厂商流式适配
- SSE 逐 token 输出、增量 iframe 预览、停止与错误分类
- 自包含单 HTML / 文件树互转与稳定 round-trip
- SEO、Open Graph、Twitter Card、charset、viewport 自动注入与完整性评测
- 对话式多轮迭代、任意轮预览和回到历史版本
- IndexedDB 本地生成历史、导入导出和容量保护
- 真实产物 ZIP 导出与 7 天临时分享
- 生成耗时、模型、站点类型、输出长度、解析结果与错误分类可观测事件

### 云端工作区

- 邮箱验证码登录、短期访问令牌、HttpOnly 刷新令牌轮换和会话撤销
- 本地历史主动迁移为云端项目，保留全部迭代轮次
- 项目 CRUD、不可变版本快照、明确版本 URL、预览和回滚
- 可视化编辑器：点选文案、图片、链接、品牌色、背景、字体、撤销重做
- 品牌套件：Logo、颜色、字体、圆角、按钮、阴影、实时多设备预览和可读性检查
- 品牌套件云端 CRUD、默认套件与跨项目复用；应用时创建不可变新版本
- 月度生成额度、使用记录和失败请求自动退回
- 一键发布、下线、重新发布，支持本地目录或 S3 兼容对象存储

### 官方模板中心与运营

- 12 套首批官方模板，覆盖 SaaS、企业官网、作品集、内容、活动、餐饮、电商、课程、文档、社区、数据大屏和个人主页
- 目录搜索、分类／行业／风格筛选、收藏与精选排序
- 响应式 iframe 预览，支持桌面、平板和手机尺寸
- 快速变量定制、品牌套件实时联动和云端项目首版创建
- 模板来源写入项目元数据，供使用、发布和质量分析
- 运营工作台支持搜索、状态筛选、精选、排序权重、使用量、发布量和负向反馈信号
- 草稿和归档模板会立即从公开目录、详情和创建接口隐藏
- 模板配置采用版本号防止多人静默覆盖，所有变更写入审计日志

### 功能开关与灰度

- 全局启停和 0–100% 稳定哈希灰度
- 按用户 ID、邮箱和角色定向开放
- 可配置生效时间和失效时间
- 版本冲突保护和审计日志
- 已定义模板中心、品牌套件、可视化编辑器、新手引导、质量反馈和一键发布等能力开关
- 公开 `/api/features` 返回当前请求上下文命中的能力结果
- 官方模板中心已使用服务端开关进行真实访问裁决

### 细粒度 RBAC

权限由服务端在每次请求中读取当前账号角色和状态，JWT 不缓存角色。

- `user`：普通产品能力
- `support`：运营概览、用户只读、模板只读、反馈读取与处理、审计和基础设施健康
- `admin`：全部运营权限，包括用户状态／角色修改、模板发布和功能开关

核心权限包括：

- `users.read`、`users.update_status`、`users.update_role`
- `templates.read`、`templates.publish`
- `feedback.read`、`feedback.resolve`
- `feature_flags.read`、`feature_flags.write`
- `audit.read`、`events.read`、`health.read`

前端只展示当前角色有权访问的工作区和操作，服务端仍是最终授权边界。

### 模板引擎

- `$M{path.to.value}` 变量替换
- `$M{if condition}` / `$M{else}` / `$M{endif}` 可嵌套条件块
- 布尔开关表单、变量即时预览和旧模板语法兼容
- ZIP 文件树和二进制资源保留

### 新手引导与质量反馈

- 目标 → 站点类型 → 创建起点 → 品牌顺序的结果导向引导
- 每一步服务端保存，支持跨设备恢复、跳过、重置和重新打开
- 启动清单自动识别品牌套件、项目和发布站点是否完成
- 项目版本轻量反馈入口，支持正向／负向、问题分类和补充说明
- 同一用户和版本幂等更新反馈，避免重复数据
- 反馈关联项目版本、模型和站点类型，由服务端校验资源归属
- 支持人员和管理员可在质量工作区筛选、查看和处理反馈

### 管理后台与可观测性

- 用户搜索、角色调整、账号限制和会话立即撤销
- 防止管理员误锁自己或降低自身权限
- 运营概览：用户、项目、发布、模板、品牌、用量、错误和慢请求
- 审计日志：操作者、目标资源、请求 ID、IP、User-Agent、前后状态和结果
- 系统事件：HTTP 错误、慢请求、生成成功、解析失败和厂商错误
- 基础设施状态：API、数据存储、邮件、对象存储和 MySQL 适配状态
- 独立模板运营、质量反馈和功能开关工作区

## 目录结构

```text
yk-site-generator/
├── apps/
│   ├── web/                 # Vue 3 + TypeScript + Vite + Vue Router + Tailwind
│   └── server/              # Hono API、认证、项目、模板、运营、分享与发布
├── packages/
│   ├── shared/              # 产物协议、SEO、品牌 Token 与官方模板渲染器
│   └── prompts/             # 14 类提示词、迭代提示词与质量评测
├── deploy/                  # PR 预览与生产部署说明
├── apps/server/db/          # MySQL 8 基线结构、增量 migration 与事务状态表
└── .github/workflows/       # 全仓 CI、真实 MySQL 8 集成和可选 Vercel Preview
```

## 本地开发

要求 Node.js 24+、pnpm 11+。

```bash
pnpm install
cp apps/server/.env.example apps/server/.env
pnpm dev
```

默认地址：

- Web：`http://localhost:5173`
- API：`http://localhost:8787`
- 健康检查：`http://localhost:8787/api/health`

Vite 会代理 `/api`、`/s` 与 `/site` 到本地 Hono 服务。需要修改目标时设置：

```bash
VITE_DEV_SERVER_TARGET=http://localhost:8787 pnpm --filter web dev
```

开发环境可通过 `ADMIN_EMAILS` 指定管理员邮箱：

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

Draft PR CI 会执行：

- pnpm frozen-lockfile 安装
- Lint 与严格 TypeScript
- Web、Server、Shared 全仓构建
- 全仓单元测试
- 真实生成、迭代和历史恢复 E2E
- MySQL 8.4 Service Container
- 全部编号 migration
- 16 路并发事务写入与 revision 校验
- 异常事务回滚和存储健康检查

失败日志作为 7 天工件保留。

## 数据存储

### 文件适配器

```env
DATA_STORAGE_DRIVER=file
DATA_STORAGE_FILE=.data/siteforge.json
```

适合开发和单实例环境。写入采用进程内串行队列、临时文件和原子重命名。

### MySQL 事务适配器

```env
DATA_STORAGE_DRIVER=mysql
MYSQL_URL=mysql://siteforge:password@127.0.0.1:3306/siteforge
MYSQL_CONNECTION_LIMIT=10
MYSQL_SSL_MODE=required
```

当前使用版本化应用快照作为安全迁移桥梁：

- `SELECT ... FOR UPDATE` 保证跨实例写入串行化
- 每次提交递增 revision
- SHA-256 校验和检测数据损坏
- 服务启动前验证连接与表结构
- SIGTERM / SIGINT 时优雅关闭连接池
- 现有业务 API 与文件适配器保持一致

数据库按编号执行 `apps/server/db/*.sql`。其中：

- `004_transactional_state.sql`：事务快照表
- `005_operations_rbac.sql`：模板运营和功能开关元数据

连接检查：

```bash
MYSQL_URL='mysql://...' pnpm --filter server db:mysql:check
```

JSON → MySQL 预检与导入：

```bash
MYSQL_URL='mysql://...' pnpm --filter server db:mysql:import -- --dry-run
MYSQL_URL='mysql://...' pnpm --filter server db:mysql:import -- --file=.data/siteforge.json
```

MySQL 已有数据时默认拒绝覆盖。显式 `--force` 前会自动导出回滚快照：

```bash
MYSQL_URL='mysql://...' pnpm --filter server db:mysql:import -- --force
```

MySQL → JSON 回滚导出：

```bash
MYSQL_URL='mysql://...' pnpm --filter server db:mysql:export -- --output=.data/mysql-rollback.json
```

然后将 `DATA_STORAGE_DRIVER=file`、`DATA_STORAGE_FILE=.data/mysql-rollback.json` 后重启即可回滚。

## 发布存储

1. S3 配置完整时使用 S3 兼容对象存储
2. 未配置时使用 `PUBLISH_STORAGE_DIR` 本地目录

支持 MinIO、Cloudflare R2、AWS S3、阿里云 OSS 等 S3 兼容服务。CDN 缓存失效可通过 Webhook 接入。

PR Preview 始终构建并上传前端产物；配置 Vercel Secrets 后自动部署并回写 PR 链接。完整流程见 `deploy/README.md`。

## 安全约束

- 用户模型 API Key 仅随请求传输，服务端不持久化、不写日志
- 生产环境必须配置独立 `AUTH_JWT_SECRET`
- 验证码有发送频率、有效期和错误次数限制
- 访问令牌短期有效，刷新令牌只保存哈希并支持轮换、撤销
- 账号限制会立即撤销全部活跃会话
- 运营权限逐请求读取，角色变化立即生效
- 模板和功能开关更新使用版本号防止丢失更新
- MySQL 迁移默认禁止覆盖已有快照，强制覆盖前自动生成回滚文件
- 每个 MySQL 快照都校验 SHA-256，不匹配时拒绝读取
- 临时分享使用随机 ID 与独立删除令牌，最多保留 7 天
- 分享与发布页面包含 CSP、Referrer-Policy、nosniff 等隔离头
- 模板变量在服务端渲染前裁剪并进行 HTML 转义
- 反馈只能关联当前登录用户拥有的项目版本
- 生成事件不记录 API Key 或用户原始需求全文
- 生成产物可能包含第三方内容，正式上线前仍需人工审核

## 阶段进度

- [x] P0 工程骨架与严格 CI
- [x] P1 真实生成、迭代、本地历史、SEO、ZIP 和临时分享
- [x] P2 核心账号、项目版本、模板条件、可视化编辑、发布和额度能力
- [x] 品牌套件与主题编辑器第一阶段
- [x] 官方模板中心第一阶段
- [x] 管理后台、审计日志与可观测性第一阶段
- [x] 新手引导与质量反馈闭环第一阶段
- [x] MySQL 8 Schema、事务适配器、JSON 迁移与回滚工具
- [x] 模板运营后台、功能开关、细粒度 RBAC 和真实 MySQL CI
- [ ] 规范化 MySQL 领域仓库与双写迁移
- [ ] 生产邮件、对象存储、CDN 与正式域名接入
- [ ] 表单线索、访问统计、套餐与支付
