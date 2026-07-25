# SiteForge 文档中心 / Documentation Hub

[中文](#中文) · [English](#english)

---

## 中文

本目录集中记录 SiteForge 的开发、部署、质量、安全和产品约束。所有面向贡献者与部署人员的 Markdown 文档都应同时提供中文和英文内容。

### 快速导航

| 文档 | 内容 |
| --- | --- |
| [`DEVELOPMENT.md`](./DEVELOPMENT.md) | 本地环境、项目结构、环境变量、数据库、调试、测试和贡献流程 |
| [`DEPLOYMENT.md`](./DEPLOYMENT.md) | 生产构建、前后端分离、Nginx、MySQL、对象存储、健康检查、监控、备份与回滚 |
| [`MODEL_PROVIDERS.md`](./MODEL_PROVIDERS.md) | 演示模式与真实生成切换、模型厂商、实时模型目录和自定义模型 ID |
| [`BUILTIN_PROJECTS.md`](./BUILTIN_PROJECTS.md) | 无需模型与登录即可使用的内置成品项目 |
| [`GENERATION_QUALITY.md`](./GENERATION_QUALITY.md) | 极速、平衡、精致三档生成策略及性能指标 |
| [`BETA_READINESS.md`](./BETA_READINESS.md) | Beta 阶段质量、性能、安全和 CI 门槛 |
| [`SECURITY_ABUSE.md`](./SECURITY_ABUSE.md) | SSRF、资源上传、账号隔离及后续安全边界 |
| [`../apps/web/tests/e2e/README.md`](../apps/web/tests/e2e/README.md) | Playwright、Axe 与视觉回归说明 |
| [`../deploy/README.md`](../deploy/README.md) | PR Preview 与部署目录入口 |

### 文档维护规则

- 新增或修改开发者文档时，中文和英文必须在同一个 PR 中同步更新。
- 命令、路径、环境变量和配置键保持原样，不翻译标识符。
- 两种语言应表达相同的约束和验收标准，不能只给另一种语言提供摘要。
- 发生行为变化时优先更新 `DEVELOPMENT.md` 或 `DEPLOYMENT.md`，再从 README 链接过去，避免多个位置出现互相冲突的步骤。
- 文档中的示例密钥、域名和密码只能使用占位值，不能提交真实凭据。

---

## English

This directory is the canonical home for SiteForge development, deployment, quality, security, and product-constraint documentation. Every Markdown document intended for contributors or operators must include both Chinese and English content.

### Quick navigation

| Document | Scope |
| --- | --- |
| [`DEVELOPMENT.md`](./DEVELOPMENT.md) | Local setup, repository structure, environment variables, databases, debugging, testing, and contribution workflow |
| [`DEPLOYMENT.md`](./DEPLOYMENT.md) | Production builds, split frontend/backend deployment, Nginx, MySQL, object storage, health checks, monitoring, backups, and rollback |
| [`MODEL_PROVIDERS.md`](./MODEL_PROVIDERS.md) | Demo versus real generation, providers, live model catalogs, and custom model IDs |
| [`BUILTIN_PROJECTS.md`](./BUILTIN_PROJECTS.md) | Ready-to-use projects that require neither a model nor authentication |
| [`GENERATION_QUALITY.md`](./GENERATION_QUALITY.md) | Fast, balanced, and quality generation modes plus performance signals |
| [`BETA_READINESS.md`](./BETA_READINESS.md) | Beta quality, performance, security, and CI gates |
| [`SECURITY_ABUSE.md`](./SECURITY_ABUSE.md) | SSRF, uploaded assets, tenant isolation, and remaining security boundaries |
| [`../apps/web/tests/e2e/README.md`](../apps/web/tests/e2e/README.md) | Playwright, Axe, and visual-regression guidance |
| [`../deploy/README.md`](../deploy/README.md) | PR Preview and deployment-directory entry point |

### Documentation maintenance rules

- Update the Chinese and English sections in the same pull request whenever contributor-facing documentation changes.
- Keep commands, paths, environment variables, and configuration keys unchanged; identifiers are not translated.
- Both languages must describe the same constraints and acceptance criteria. One language must not be reduced to a summary.
- When runtime behavior changes, update `DEVELOPMENT.md` or `DEPLOYMENT.md` first and link from the root README to avoid conflicting procedures.
- Examples must use placeholder secrets, domains, and passwords. Never commit real credentials.
