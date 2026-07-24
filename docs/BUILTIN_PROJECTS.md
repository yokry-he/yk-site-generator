# 内置成品项目 / Built-in Starter Projects

[中文](#中文) · [English](#english)

---

## 中文

### 1. 设计目标

内置成品项目让用户跳过模型配置、API Key、需求填写和登录，直接从完整、可运行的网站开始。AI 是后续深度定制能力，而不是进入产品的前置条件。

### 2. 用户路径

1. 打开 `/starters`。
2. 选择一个成品项目并点击“直接使用”。
3. 在本地工作台切换桌面或手机预览。
4. 使用可视化编辑器修改内容和样式。
5. 导出 HTML/ZIP，或创建 7 天临时分享。
6. 需要跨设备同步和不可变版本时，再登录保存到云端。
7. 需要更深改造时，可选进入 AI 深度定制。

### 3. 当前目录

| 项目 | 适用场景 |
| --- | --- |
| AI 产品发布站 | SaaS、AI 工具、产品上线与预约演示 |
| 企业服务官网 | 咨询、制造、企业服务与客户留资 |
| 个人作品集 | 设计师、摄影师、顾问与独立开发者 |
| 餐厅预约主页 | 餐厅、咖啡馆、酒吧与生活方式品牌 |
| 课程招生页 | 课程主理人、培训机构和训练营 |
| 运营数据看板 | 运营、物流、零售和业务汇报 |

每个项目都引用经过测试的官方模板，并使用完整默认内容渲染，不依赖模型调用或模板 API。

### 4. 本地草稿

- 编辑结果约 350ms 防抖后写入浏览器本地存储。
- 刷新页面自动恢复。
- 项目库显示已有本地草稿。
- 最多保留最近 8 个项目草稿。
- 单个 HTML 草稿上限为 1.5MB。
- 用户可随时恢复为内置初始版本。
- 草稿不包含模型 API Key，也不会自动上传到服务端。

本地草稿适合快速试用与离线编辑。它不是跨设备备份；需要长期保存时应登录创建云端项目。

### 5. 可用操作

匿名用户可以：

- 预览完整网站
- 切换设备宽度
- 可视化编辑
- 在新标签打开
- 导出 HTML
- 导出 ZIP
- 创建临时分享
- 恢复内置版本

登录用户还可以：

- 保存为云端项目
- 创建不可变新版本
- 使用项目工作区、品牌套件、质量检查和发布能力

### 6. 质量门禁

- `/starters`、`/starters/:slug` 和 `/generator` 必须正常挂载，主内容不能为空。
- 公共页面测试收集 `pageerror`，任何未处理运行时错误都会阻断 CI。
- 桌面和移动端执行 Axe serious/critical 检查。
- 所有关键路由执行移动端横向溢出检查。
- 页面进入动效只改变位置，不降低正文透明度。
- 内置项目 ID、slug 和模板引用必须唯一且有效。
- 渲染结果必须包含完整 `doctype`、`html`、`head`、`body`、title 和 description。
- 默认内容不得包含 lorem ipsum、未替换变量、空白 CTA 或明显占位文案。
- 本地草稿数量与字节上限必须有单元测试。

### 7. 新增内置项目

新增项目时：

1. 优先复用经过测试的官方模板。
2. 在 `packages/shared/src/starterProjects.ts` 增加唯一 ID 和 slug。
3. 提供明确受众、用途和亮点。
4. 默认内容必须可直接交付，不依赖用户先编辑。
5. 增加共享目录单元测试。
6. 将项目加入桌面和移动端浏览器路由测试。
7. 验证 HTML/ZIP 导出、可视化编辑和本地草稿。
8. 同步更新本文档的中文与英文目录。

### 8. 产品原则

- 零配置路径在模型、登录或模板 API 暂时不可用时仍应工作。
- 内置项目是成品起点，不是营销截图或空壳模板。
- 匿名用户不应被强制登录后才能编辑或导出。
- AI 深度定制必须是可选升级路径。
- 登录仅用于云端保存、跨设备同步和版本管理。

---

## English

### 1. Design goal

Starter projects let users skip model setup, API keys, requirement writing, and authentication, then begin with a complete runnable website. AI is an optional deep-customization capability, not an entry requirement.

### 2. User flow

1. Open `/starters`.
2. Choose a project and select “Use now”.
3. Switch between desktop and mobile previews in the local workspace.
4. Edit content and styling with the visual editor.
5. Export HTML/ZIP or create a seven-day temporary share.
6. Log in only when cross-device sync and immutable cloud versions are needed.
7. Optionally move into AI deep customization for larger changes.

### 3. Current catalog

| Project | Intended use |
| --- | --- |
| AI product launch site | SaaS, AI tools, launches, and demo conversion |
| Enterprise services site | Consulting, manufacturing, enterprise services, and lead capture |
| Personal portfolio | Designers, photographers, consultants, and indie developers |
| Restaurant reservation site | Restaurants, cafés, bars, and lifestyle brands |
| Course enrollment page | Course creators, training companies, and cohorts |
| Operations dashboard | Operations, logistics, retail, and business reporting |

Every project references a tested official template and renders with complete default content. It does not depend on model calls or the template API.

### 4. Local drafts

- Edits are written to browser storage after roughly a 350ms debounce.
- Refreshing the page restores the draft.
- The catalog indicates when a local draft exists.
- At most eight recent starter drafts are retained.
- Each HTML draft is limited to 1.5MB.
- Users can restore the original built-in version at any time.
- Drafts contain no model API keys and are not uploaded automatically.

Local drafts are suitable for quick trials and offline editing. They are not cross-device backups; users should create a cloud project for durable storage.

### 5. Available actions

Anonymous users can:

- Preview the complete site
- Switch device width
- Use the visual editor
- Open the site in a new tab
- Export HTML
- Export ZIP
- Create a temporary share
- Restore the built-in version

Authenticated users can also:

- Save a cloud project
- Create immutable versions
- Use the project workspace, brand kits, quality checks, and publishing

### 6. Quality gates

- `/starters`, `/starters/:slug`, and `/generator` must mount with non-empty main content.
- Public-page tests collect `pageerror`; any unhandled runtime error blocks CI.
- Desktop and mobile run Axe serious/critical checks.
- Every key route is checked for mobile horizontal overflow.
- Entry animations change position only and never fade body content.
- Starter IDs, slugs, and template references must be unique and valid.
- Rendered output must include complete `doctype`, `html`, `head`, `body`, title, and description.
- Default content must contain no lorem ipsum, unresolved variables, empty CTAs, or obvious placeholders.
- Local-draft count and byte limits must have unit tests.

### 7. Adding a starter project

When adding a project:

1. Prefer a tested official template.
2. Add a unique ID and slug in `packages/shared/src/starterProjects.ts`.
3. Define clear audience, use case, and highlights.
4. Default content must be ready to use before editing.
5. Add shared-catalog unit tests.
6. Add the route to desktop and mobile browser coverage.
7. Verify HTML/ZIP export, visual editing, and local drafts.
8. Update both the Chinese and English catalogs in this document.

### 8. Product principles

- The zero-configuration path must keep working when model, login, or template services are temporarily unavailable.
- Starter projects are production-quality starting points, not marketing screenshots or empty shells.
- Anonymous users must not be forced to log in before editing or exporting.
- AI deep customization is an optional upgrade path.
- Authentication is required only for cloud persistence, cross-device sync, and version management.
