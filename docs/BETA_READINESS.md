# SiteForge Beta 就绪基线 / Beta Readiness Baseline

[中文](#中文) · [English](#english)

更新日期 / Last updated: 2026-07-25

---

## 中文

### 1. 目标

Beta Readiness 阶段优先验证已有核心链路，而不是继续横向扩展支付、自定义域名、市场等商业能力。目标是让生成、编辑、模板、内置项目、项目版本、品牌、分享和发布具备可重复验证、可审计、可逐步收紧的质量基线。

### 2. 当前核心门槛

#### 2.1 真实模型生成质量

无凭据自检：

```bash
pnpm --filter prompts eval:quality -- --dry-run
```

`--dry-run` 只验证用例、评分器、报告和阈值逻辑，不调用模型，也不能代表真实生成质量。

真实评测：

```bash
EVAL_BASE_URL=https://provider.example.com/v1 \
EVAL_API_KEY=replace-me \
EVAL_MODEL=model-name \
pnpm --filter prompts eval:quality -- --runs 3
```

默认门槛：

| 指标 | 门槛 |
| --- | ---: |
| 总体质量分 | ≥ 80% |
| 单站点类型质量分 | ≥ 80% |
| 产物协议解析成功率 | ≥ 98% |
| SEO head 完整率 | ≥ 95% |
| HTML 基本健全率 | ≥ 95% |

真实报告不得包含 API Key。每个用例建议至少运行 3 次，避免用单次输出代表稳定性。

当前外部阻塞：仓库仍需要 `EVAL_API_KEY`、`EVAL_BASE_URL` 和 `EVAL_MODEL`，才能形成权威的真实模型矩阵。

#### 2.2 生成策略

| 策略 | 默认预算 | 目标 |
| --- | ---: | --- |
| 极速草稿 | 2800 tokens | 4–6 个关键区块，优先完整与快速 |
| 平衡生成 | 4600 tokens | 6–8 个完整区块，平衡质量、内容和速度 |
| 精致成品 | 7200 tokens | 7–10 个高完成度区块，包含无障碍和性能自检 |

无论使用哪种策略，完整、可运行产物都优先于装饰数量。

#### 2.3 Web Bundle 预算

```bash
pnpm --filter web build
pnpm --filter web check:bundle-budget
```

当前硬门槛：

| 指标 | 上限 |
| --- | ---: |
| JS gzip 总量 | 350 KiB |
| 最大单个 JS gzip | 80 KiB |
| CSS gzip 总量 | 25 KiB |
| 全部构建产物原始总量 | 1200 KiB |

报告默认写入 `artifacts/web-bundle-budget.json`。门槛只能基于明确的测量和评审调整，不能为了让失败变绿而随意放宽。

#### 2.4 浏览器质量

Playwright 在桌面与 Pixel 7 视口验证：

- 公共路由正常挂载，主内容不为空
- 无未处理 `pageerror`
- Axe serious/critical 为零
- Skip Link、键盘顺序和弹层焦点恢复正确
- 关键页面无移动端横向溢出
- 视觉回归有可解释的产品差异
- 页面进入动画不通过降低整体透明度制造瞬时低对比内容

#### 2.5 零配置可用性

即使没有模型、API Key、登录或模板 API，用户仍必须能够：

- 打开 `/starters`
- 进入完整内置项目
- 可视化编辑
- 使用本地自动草稿
- 导出 HTML/ZIP
- 可选创建临时分享

AI 是深度定制能力，不是基本使用的前置条件。

### 3. 安全基线

当前实现包括：

- 自定义 Provider URL 的协议、字面地址和 DNS A/AAAA 校验
- 阻断本机、私网、链路本地、元数据、文档和保留地址
- 阻断整数、十六进制、缩写 IPv4、IPv4-mapped IPv6 和 6to4 绕过
- 模型请求禁止自动跟随重定向
- 品牌资源和品牌套件图片执行严格 Base64、文件签名、大小和静态 SVG 校验
- 项目、版本、发布、品牌套件和品牌资源跨账号所有权矩阵
- 私有资源对其他账号统一返回 404，降低枚举信号

本地模型开发可显式设置：

```env
ALLOW_PRIVATE_PROVIDER_BASE_URLS=true
```

公共生产环境必须保持 `false`。

仍待完成：连接层 DNS pinning 或隔离出口代理、分享删除令牌时序与并发测试、请求体和超大产物资源耗尽门槛。

### 4. CI 门禁

普通 Pull Request CI 执行：

1. `pnpm install --frozen-lockfile`
2. Lint
3. Typecheck
4. Web、Server、Shared 构建
5. Web Bundle 预算
6. Prompt 质量管线 dry-run
7. 全仓单元测试
8. 条件式真实模型生成与迭代 E2E
9. IndexedDB 历史恢复
10. MySQL 8.4 migration、并发和回滚
11. Playwright 行为与无障碍
12. 视觉回归

失败诊断和质量报告作为 GitHub Actions Artifact 保留。

真实模型矩阵不默认在每个 PR 上运行，以避免不可控成本和供应商波动。它应使用固定模型版本、固定参数、明确预算和可追踪报告手动或定期运行。

### 5. 发布候选验收

发布候选版本必须满足：

- 所有常规 CI Job 成功
- Preview 构建成功
- MySQL 连接和 Schema 检查成功
- 登录、内置项目、生成、编辑、保存版本、分享、发布和下线冒烟测试通过
- 没有严重或致命 Axe 问题
- 没有未解释的视觉回归
- 没有已知跨账号越权
- 生产 Secrets、CORS、HTTPS、邮件和对象存储配置经过复核
- 已准备备份与回滚步骤

### 6. 下一批工作

优先顺序：

1. 配置真实模型 Secrets，运行平衡与精致模式质量矩阵。
2. 增加请求体字节限制、超大生成结果和慢速 SSE 资源耗尽测试。
3. 完成分享删除令牌的常量时间比较、过期和并发删除测试。
4. 完成连接层 DNS pinning 或隔离 Provider 出口代理。
5. 建立首 token、首次有效预览、完整生成和真实用户性能趋势。
6. 在质量与安全基线稳定后推进多页面站点协议。

---

## English

### 1. Goal

Beta Readiness prioritizes verification of the existing core workflow instead of expanding into payments, custom domains, or a marketplace. Generation, editing, templates, starter projects, project versions, brands, shares, and publishing should have repeatable, auditable, progressively stricter quality gates.

### 2. Current core gates

#### 2.1 Real-model generation quality

Credential-free pipeline check:

```bash
pnpm --filter prompts eval:quality -- --dry-run
```

`--dry-run` validates cases, scoring, reports, and thresholds only. It does not call a model and is not evidence of real generation quality.

Real evaluation:

```bash
EVAL_BASE_URL=https://provider.example.com/v1 \
EVAL_API_KEY=replace-me \
EVAL_MODEL=model-name \
pnpm --filter prompts eval:quality -- --runs 3
```

Default thresholds:

| Metric | Threshold |
| --- | ---: |
| Overall quality score | ≥ 80% |
| Per-site-type quality score | ≥ 80% |
| Artifact protocol parse rate | ≥ 98% |
| SEO head completeness | ≥ 95% |
| Basic HTML sanity | ≥ 95% |

Real reports must not contain API keys. Run every case at least three times so one output is not mistaken for stability.

Current external blocker: the repository still needs `EVAL_API_KEY`, `EVAL_BASE_URL`, and `EVAL_MODEL` before it can produce an authoritative real-model matrix.

#### 2.2 Generation modes

| Mode | Default budget | Target |
| --- | ---: | --- |
| Fast draft | 2800 tokens | 4–6 essential sections, optimized for completeness and speed |
| Balanced | 4600 tokens | 6–8 complete sections balancing quality, content, and speed |
| Quality | 7200 tokens | 7–10 polished sections with accessibility and performance self-checks |

In every mode, a complete and runnable artifact is more important than decorative volume.

#### 2.3 Web bundle budget

```bash
pnpm --filter web build
pnpm --filter web check:bundle-budget
```

Current hard limits:

| Metric | Limit |
| --- | ---: |
| Total JS gzip | 350 KiB |
| Largest single JS gzip | 80 KiB |
| Total CSS gzip | 25 KiB |
| Total raw build assets | 1200 KiB |

The report is written to `artifacts/web-bundle-budget.json`. Limits may be changed only after measurement and review, never merely to make a failure green.

#### 2.4 Browser quality

Playwright validates desktop and Pixel 7 viewports for:

- Public routes mount with non-empty main content
- No unhandled `pageerror`
- Zero Axe serious/critical violations
- Correct skip-link, keyboard order, and overlay focus restoration
- No mobile horizontal overflow on key pages
- Visual changes are explainable product changes
- Entry animations never create temporary low contrast by fading entire content blocks

#### 2.5 Zero-configuration usability

Without a model, API key, login, or template API, users must still be able to:

- Open `/starters`
- Enter a complete starter project
- Use the visual editor
- Use local autosave drafts
- Export HTML/ZIP
- Optionally create a temporary share

AI is an optional deep-customization capability, not a prerequisite for basic use.

### 3. Security baseline

Current protections include:

- Protocol, literal-address, and DNS A/AAAA checks for custom provider URLs
- Blocking loopback, private, link-local, metadata, documentation, and reserved ranges
- Blocking integer, hexadecimal, short IPv4, IPv4-mapped IPv6, and 6to4 bypasses
- No automatic redirects for model requests
- Strict Base64, signature, size, and static-SVG validation for brand assets and brand-kit images
- Cross-account ownership matrices for projects, versions, publications, brand kits, and brand assets
- Uniform 404 responses for another tenant's private resources to reduce enumeration signals

Trusted local-model development may explicitly set:

```env
ALLOW_PRIVATE_PROVIDER_BASE_URLS=true
```

Public production environments must keep it `false`.

Remaining work includes connection-level DNS pinning or isolated egress, timing/concurrency tests for share deletion tokens, request-body byte limits, and resource-exhaustion gates for oversized artifacts.

### 4. CI gates

Normal pull-request CI runs:

1. `pnpm install --frozen-lockfile`
2. Lint
3. Typecheck
4. Web, Server, and Shared builds
5. Web bundle budget
6. Prompt-quality dry run
7. All unit tests
8. Conditional real-model generation and iteration E2E
9. IndexedDB history restoration
10. MySQL 8.4 migrations, concurrency, and rollback
11. Playwright behavior and accessibility
12. Visual regression

Failure diagnostics and quality reports are retained as GitHub Actions artifacts.

The real-model matrix does not run on every PR because cost and provider variance are not deterministic. Run it manually or on a schedule with a pinned model version, fixed parameters, explicit budget, and traceable reports.

### 5. Release-candidate acceptance

A release candidate must satisfy:

- Every standard CI job succeeds
- Preview build succeeds
- MySQL connectivity and schema checks succeed
- Login, starter project, generation, editing, version save, share, publish, and unpublish smoke tests pass
- No serious or critical Axe violations
- No unexplained visual regressions
- No known cross-account authorization bypass
- Production secrets, CORS, HTTPS, email, and object-storage configuration are reviewed
- Backup and rollback procedures are ready

### 6. Next work

Priority order:

1. Configure real-model secrets and run balanced-versus-quality matrices.
2. Add byte-level request limits plus oversized-output and slow-SSE resource-exhaustion tests.
3. Complete constant-time comparison, expiry, and concurrent deletion tests for share deletion tokens.
4. Add connection-level DNS pinning or an isolated provider-egress proxy.
5. Build trends for first token, first useful preview, complete generation, and real-user performance.
6. Start the multi-page site protocol only after quality and security baselines are stable.
