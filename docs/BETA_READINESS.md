# SiteForge Beta Readiness

更新日期：2026-07-24

## 目标

本阶段不继续横向扩展市场、支付、自定义域名等商业化能力，而是把已有核心建站链路提升到可重复验证、可审计、可逐步收紧门槛的 Beta 基线。

当前工作采用堆叠分支：

- 集成基线：`agent/continue-development-20260723`（PR #26，冻结新增功能）
- Beta Readiness：`agent/beta-readiness-foundation-20260724`
- Beta Readiness PR 应以集成基线分支为 base，避免把新增工作继续塞入 PR #26

## 第一阶段质量门槛

### 生成质量

命令：

```bash
pnpm --filter prompts eval:quality -- --dry-run
```

`--dry-run` 只验证评测管线、评分器、报告生成和阈值逻辑，不能代表真实模型质量。真实评测必须配置：

```bash
EVAL_BASE_URL=https://example.com/v1 \
EVAL_API_KEY=*** \
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

可通过 `EVAL_MIN_OVERALL`、`EVAL_MIN_SITE_TYPE`、`EVAL_MIN_PARSEABLE`、`EVAL_MIN_HEAD_COMPLETE` 和 `EVAL_MIN_HTML_SANE` 调整。真实模型报告中不写入 API Key。

评测报告默认写入 `artifacts/prompt-eval.json`，包含每次执行、站点类型汇总、耗时、失败原因和门槛判定。建议真实基准每个用例至少运行 3 次，以观察稳定性，而不是只采信单次结果。

### Web Bundle 性能预算

命令：

```bash
pnpm --filter web build
pnpm --filter web check:bundle-budget
```

首次 CI 测量基线为：JS gzip 总量约 285 KiB、最大 JS gzip 约 64 KiB、CSS gzip 总量约 15 KiB、全部构建产物原始总量约 926 KiB。基于该结果保留约 20%–65% 的合理增长空间，而不是使用无法及时发现回退的宽松上限：

| 指标 | 当前上限 |
| --- | ---: |
| JS gzip 总量 | 350 KiB |
| 最大单个 JS gzip | 80 KiB |
| CSS gzip 总量 | 25 KiB |
| 全部构建产物原始总量 | 1200 KiB |

报告默认写入 `artifacts/web-bundle-budget.json`。可通过 `BUNDLE_MAX_TOTAL_JS_GZIP_KB`、`BUNDLE_MAX_LARGEST_JS_GZIP_KB`、`BUNDLE_MAX_TOTAL_CSS_GZIP_KB` 和 `BUNDLE_MAX_TOTAL_ASSET_KB` 调整。

### 安全基线

自定义模型 Base URL 默认禁止访问：

- `localhost` 与本地域名后缀
- IPv4 私网、环回、共享地址、链路本地地址
- 云元数据地址
- IPv4/IPv6 文档与保留地址
- IPv6 环回、唯一本地、链路本地与多播地址
- 包含用户名、密码、查询参数或 URL 片段的地址
- 生产环境中的非 HTTPS 自定义地址

本地模型开发如确有需要，必须显式设置：

```bash
ALLOW_PRIVATE_PROVIDER_BASE_URLS=true
```

该开关不得在公共生产环境开启。当前策略优先阻断显式危险主机和地址；后续安全阶段仍需增加 DNS 解析后地址校验、重定向逐跳校验和 DNS rebinding 防护。

## CI 行为

普通 PR CI 现在会：

1. Lint 与 Typecheck
2. 构建 Web、Server、Shared
3. 执行 Web Bundle 性能预算
4. 执行 Prompt 质量评测管线自检
5. 上传 `beta-readiness-reports` Artifact
6. 执行全仓单元测试、生成链路 E2E、历史恢复 E2E
7. 执行 MySQL 8 集成测试
8. 执行 Playwright 行为、Axe 与视觉回归

真实模型 42 用例矩阵不会默认在每个 PR 上运行，避免不可控成本和供应商波动。它应在固定模型版本、固定参数和明确预算下手动或定期执行，并保存报告用于趋势对比。

## 下一批工作

- 给真实模型质量报告增加历史趋势和模型 × 站点类型矩阵
- 增加移动端溢出、Axe 和运行时页面质量到生成评测
- 增加 ZIP Bomb、路径穿越、危险 SVG、发布 IDOR 与超大产物对抗测试
- 增加 DNS 解析和重定向链路的 SSRF 防护
- 建立 LCP、CLS、INP、首次 Token 和首次有效预览指标
- 在质量基线稳定后开始多页面站点数据协议与共享布局
