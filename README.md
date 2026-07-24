# SiteForge · yk-site-generator

![CI](https://github.com/yokry-he/yk-site-generator/actions/workflows/ci.yml/badge.svg)

一句话描述需求，AI 帮你生成、迭代、编辑、统一品牌、检查质量、导出并发布完整网站。仓库采用 pnpm monorepo，覆盖 14 类站点、多模型 SSE 生成、24 套官方模板、品牌套件与资源库、云端项目版本、发布管理和运营质量闭环。

- 任务总览：Issue #1
- 当前开发分支：`agent/continue-development-20260723`
- 当前集成 PR：Draft PR #26，开发期间不合并到 `main`

## 已实现能力

### AI 生成与恢复

- OpenAI 兼容、Anthropic、Gemini 多厂商流式适配
- SSE 逐 token 输出、增量 iframe 预览、主动停止和错误分类
- 结构化需求向导：目标受众、页面目标、风格、语气、CTA、区块、语言和参考素材
- 向导答案自动整理为可继续编辑的生成需求摘要
- 对话式多轮迭代、任意轮预览和回到历史版本
- 局部 AI 修改：在编辑器中按预设或自由指令优化页面
- 请求失败保留原需求、最近请求和部分输出，可直接重试或基于中断内容继续
- 解析失败不覆盖上一完整结果，并提供明确恢复路径
- IndexedDB 本地生成历史、导入导出和容量保护
- 自包含单 HTML / 文件树互转与稳定 round-trip
- SEO、Open Graph、Twitter Card、charset、viewport 自动注入与完整性评测
- 真实产物 ZIP 导出与 7 天临时分享
- 生成耗时、模型、站点类型、输出长度、解析结果与错误分类可观测事件

### 可视化编辑器 2.0

- 语义页面结构树：Header、Hero、Section、Main、Article、Footer 等
- 区块选择、重命名、上移、下移、复制、隐藏、锁定和删除
- 区块库插入：标题正文、双栏、功能卡片、数据指标、评价、FAQ、CTA、图片、按钮等常用区块
- 点选文字、图片、链接和按钮直接编辑
- 链接地址、打开方式、替代文字和可读名称设置
- 元素级字号、字重、行高、间距、宽度、对齐、圆角、阴影和布局设置
- 桌面、平板、手机断点样式覆盖与继承
- 全局强调色、背景、文字色和字体覆盖
- 撤销、重做和删除后恢复
- 浏览器本地自动草稿、草稿恢复、放弃修改和保存状态提示
- `Ctrl/⌘ + S` 保存，`Ctrl/⌘ + Z` 撤销，`Ctrl/⌘ + Shift + Z` 重做
- 保存为不可变新版本后编辑器保持打开，可继续修改
- 手机端底部 Sheet 编辑面板，不再要求切换桌面端

### 项目与版本工作区

- 项目 CRUD、不可变版本快照、明确版本 URL、预览和回滚
- 项目搜索、站点类型筛选、模板来源筛选和更新时间排序
- 网格／列表视图
- 项目收藏、复制、归档、回收站、恢复和永久删除
- 永久删除必须输入完整项目名称确认，避免误删不可恢复的数据
- 最近打开时间、模板来源、品牌套件和项目封面元数据
- 项目概览：当前版本、发布状态、质量得分、版本数量和下一步建议
- 版本自定义名称、备注、收藏、来源和修改摘要
- 父版本关系与从任意版本创建新版本
- 双版本并排预览，支持仅查看当前版或对比版
- 品牌、编辑、质量检查、导出和发布统一在项目工作区完成
- 本地历史可主动迁移为云端项目并保留全部迭代轮次
- 月度生成额度、使用记录和失败请求自动退回
- 一键发布、下线和重新发布，支持本地目录或 S3 兼容对象存储

### 站点质量检查中心

- 内容：空标题、多个 H1、标题层级跳跃、占位文案和模糊链接名称
- 图片：缺少 Alt、空地址、非 HTTPS 地址和懒加载建议
- 链接：空链接、失效锚点和新窗口安全属性
- 响应式：缺少 viewport、超大固定宽度和过小字号
- 无障碍：页面语言、表单标签、按钮可读名称和 main 主区域
- SEO：Title、Description、Favicon 和 Open Graph
- 0–100 质量评分和错误／警告／建议分级
- 按分类、严重程度和关键词筛选
- 在编辑器预览中定位问题元素
- 单项安全自动修复和批量安全修复
- 可忽略单条规则，不影响其他检查项
- 项目概览和编辑器共用同一套质量分析规则
- Playwright 浏览器行为矩阵覆盖桌面与 Pixel 7 手机视口，验证首页、命令面板、模板目录／详情、项目工作区、编辑器及关键 Dialog／Drawer 的键盘操作
- Axe 自动无障碍门槛禁止 serious 或 critical 违规，并检查图标按钮的可访问名称
- 自动验证 Skip Link 是首次 Tab 可达元素、弹层焦点进入与恢复正确、关键页面无横向溢出
- 视觉回归覆盖首页、全局命令面板、模板目录、模板详情、项目工作区、可视化编辑器和深色模板详情的桌面／手机截图

### 品牌套件与资源库

- 品牌套件：Logo、Favicon、颜色、字体、圆角、按钮和阴影
- 实时桌面／平板／手机预览和颜色可读性检查
- 云端 CRUD、默认套件和跨项目复用；应用时创建不可变新版本
- 品牌资源库：Logo、图片、图标、背景和文档
- 批量上传、名称／类型／Alt／标签编辑和品牌套件关联
- 按名称、标签、类型和品牌套件筛选
- 复制资源地址后可直接用于编辑器图片字段
- 用户间资源严格隔离，删除资源不会破坏已插入项目的副本
- 删除品牌资源前展示关联品牌套件、项目版本与已插入副本的影响范围，并通过统一危险操作确认

### 官方模板中心 2.0

- 24 套官方模板，覆盖 SaaS、企业官网、作品集、内容、活动、餐饮、电商、课程、文档、社区、数据大屏、个人主页、AI 工具、移动应用、咨询、房地产、医疗、法律、非营利、婚礼、播客、Newsletter 和游戏等场景
- 目录搜索、分类／行业／风格筛选
- 精选、名称、类型、最近使用和收藏排序
- 登录用户云端收藏；匿名用户保留本地收藏
- 响应式 iframe 预览，支持桌面、平板和手机尺寸
- 模板卡片提供快速预览，独立详情页提供完整多端预览、变量定制、品牌联动与创建项目入口
- 快速变量定制和品牌套件实时联动
- 三种快速配色变体
- 相似模板推荐
- 模板创建云端项目并保存为不可变首版
- 模板来源、品牌套件和最近使用时间写入项目元数据
- 运营工作台支持状态、精选、排序权重、使用量、发布量和负向反馈信号
- 草稿和归档模板会立即从公开目录、详情和创建接口隐藏
- 模板配置采用版本号防止多人静默覆盖，所有变更写入审计日志

### 全局命令面板

- `Ctrl/⌘ + K` 打开全局命令面板
- 新建网站、打开模板、项目、品牌套件、品牌资源和用量页
- 搜索并打开最近项目
- 管理员和支持人员可进入被授权的运营工作区
- 命令根据登录状态、RBAC 权限和功能开关动态变化
- 键盘上下选择、Enter 执行和 Escape 关闭

### 功能开关与灰度

- 全局启停和 0–100% 稳定哈希灰度
- 按用户 ID、邮箱和角色定向开放
- 可配置生效时间和失效时间
- 版本冲突保护和审计日志
- 模板中心、品牌套件、可视化编辑器、新手引导、质量反馈和一键发布能力开关
- `/api/features` 返回当前请求上下文命中的能力结果
- 前端根据开关隐藏入口，服务端继续执行最终访问裁决
- 发布 Kill Switch 关闭时仍允许查看、下线和删除已有站点

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

### 新手引导、反馈与运营

- 目标 → 站点类型 → 创建起点 → 品牌顺序的结果导向引导
- 每一步服务端保存，支持跨设备恢复、跳过、重置和重新打开
- 启动清单自动识别品牌套件、项目和发布站点是否完成
- 项目版本轻量反馈入口，支持正向／负向、问题分类和补充说明
- 同一用户和版本幂等更新反馈，避免重复数据
- 反馈关联项目版本、模型和站点类型，由服务端校验资源归属
- 支持人员和管理员可在质量工作区筛选、查看和处理反馈
- 用户搜索、角色调整、账号限制和会话立即撤销
- 防止管理员误锁自己或降低自身权限
- 运营概览、审计日志、系统事件和基础设施状态

## 目录结构

```text
yk-site-generator/
├── apps/
│   ├── web/                 # Vue 3 + TypeScript + Vite + Vue Router + Tailwind
│   └── server/              # Hono API、认证、项目、模板、品牌、运营、分享与发布
├── packages/
│   ├── shared/              # 产物协议、SEO、品牌 Token 与 24 套官方模板
│   └── prompts/             # 14 类提示词、迭代提示词与质量评测
├── deploy/                  # PR 预览与部署说明
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

Vite 会代理 `/api`、`/s` 与 `/site` 到本地 Hono 服务：

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
pnpm --filter web e2e:browser
pnpm --filter web e2e:visual
pnpm --filter web e2e:visual:update
pnpm --filter prompts eval -- --dry-run
```

Draft PR CI 会执行：

- pnpm frozen-lockfile 安装
- Lint 与严格 TypeScript
- Web、Server、Shared 全仓构建
- 全仓单元测试
- 项目生命周期、版本元数据、品牌资源和模板收藏集成测试
- 真实生成、迭代和历史恢复 E2E
- Playwright 桌面与手机行为矩阵、响应式溢出、Skip Link、焦点管理和键盘操作
- Axe serious／critical 自动无障碍门槛
- 首页、命令面板、模板、项目工作区、编辑器与深色页面的视觉回归比较
- MySQL 8.4 Service Container
- 全部编号 migration，包括 `006_product_polish.sql`
- schema v6 快照校验
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

数据库按编号执行 `apps/server/db/*.sql`：

- `004_transactional_state.sql`：事务快照表
- `005_operations_rbac.sql`：模板运营和功能开关元数据
- `006_product_polish.sql`：项目生命周期、版本元数据、品牌资源和模板收藏

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

## 安全约束

- 用户模型 API Key 仅随请求传输，服务端不持久化、不写日志
- 生产环境必须配置独立 `AUTH_JWT_SECRET`
- 验证码有发送频率、有效期和错误次数限制
- 访问令牌短期有效，刷新令牌只保存哈希并支持轮换、撤销
- 账号限制会立即撤销全部活跃会话
- 运营权限逐请求读取，角色变化立即生效
- 模板和功能开关更新使用版本号防止丢失更新
- 项目、版本、品牌资源和模板收藏均按当前用户隔离
- 项目删除先清理发布产物，回收站操作不会立即永久删除
- 编辑器草稿保存在本机，保存时创建不可变云端新版本
- 质量自动修复仅处理可安全确定的规则
- MySQL 迁移默认禁止覆盖已有快照，强制覆盖前自动生成回滚文件
- 每个 MySQL 快照都校验 SHA-256，不匹配时拒绝读取
- 临时分享使用随机 ID 与独立删除令牌，最多保留 7 天
- 分享与发布页面包含 CSP、Referrer-Policy、nosniff 等隔离头
- 模板变量在服务端渲染前裁剪并进行 HTML 转义
- 反馈只能关联当前登录用户拥有的项目版本
- 生成事件不记录 API Key 或用户原始需求全文
- 生成产物可能包含第三方内容，正式使用前仍需人工审核

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
- [x] 可视化编辑器 2.0 与响应式区块编辑
- [x] 项目生命周期、版本管理和双版本对比
- [x] 结构化生成向导、局部 AI 修改和失败恢复
- [x] 站点质量检查中心与安全自动修复
- [x] 官方模板中心 2.0，24 套模板与云收藏
- [x] 品牌资源库
- [x] 全局命令面板

当前阶段明确暂停生产基础设施、商业化、套餐和支付相关开发，优先继续补全产品能力与体验细节。
