# RC 诊断聚合与修复优先级 / RC Diagnostic Triage and Remediation Priority

[中文](#中文) · [English](#english)

## 中文

### 目标

RC 各阶段会分别产生环境预检、依赖、核心 Gate、Workflow 漂移、安全、数据库、浏览器和五栈运行日志。`rc:triage` 将这些离散报告汇总成一份稳定的 JSON／Markdown 修复清单，避免首次真实运行时需要人工逐个下载和比对 Artifact。

### 命令

```bash
pnpm rc:triage:plan
pnpm rc:triage
pnpm rc:triage:strict
```

等价的零依赖调用：

```bash
node scripts/rc-triage.mjs \
  --source-root=artifacts \
  --report-dir=artifacts/rc-triage/local \
  --scope=local \
  --allow-missing \
  --fail-on=blocking
```

### 优先级

| 优先级 | 含义 | 示例 |
| --- | --- | --- |
| P0 | 立即停止候选发布 | 安全审计失败、生成完整性失败、Runner 隔离策略失败、Workflow 绕过共享 Bootstrap、包完整性校验失败 |
| P1 | 发布阻断，必须修复 | Typecheck、Build、单测、数据库、Redis、浏览器、五栈运行、冻结锁文件和离线 Store 失败 |
| P2 | 质量问题，应在 RC 前修复 | Lint、双语文档、Bundle 预算、Prompt dry-run、Registry 暂时不可用 |
| P3 | 建议或覆盖不足 | 非必需工具缺失、可选报告缺失、低风险环境警告 |

P0 和 P1 默认标记为 `blocking`。`--fail-on=blocking` 会在存在阻断项时返回非零状态；`--fail-on=never` 只生成报告。

### 输入

脚本递归读取 `--source-root` 下的候选 JSON：

- `latest.json`
- `summary.json`
- `report.json`
- `result.json`
- `security-audit.json`

当前识别：

- `rc-preflight`
- `rc-dependencies`
- `rc-gates`
- `rc-workflow-bootstrap`
- 安全审计
- Golden／数据库运行矩阵
- 通用 `ok: false` 或失败状态报告

可重复传入外部 Job 状态：

```bash
--external-status=browser-quality:failure
--external-status=mysql-integration:success
```

这用于补充没有结构化 JSON 的 GitHub Job 结果。

### 去重与责任域

同一问题同时出现在时间戳报告和 `latest.json` 时只保留一条，并保留更高优先级。每条 Finding 包含：

- 优先级和是否阻断
- 来源、类别和稳定错误码
- 标题与证据路径
- 建议修复动作
- 默认责任域

责任域包括 Release Engineering、Security Engineering、Application Engineering、Frontend Engineering、Platform Infrastructure 和 Stack Maintainers。

### 输出

```text
artifacts/rc-triage/<scope>/<timestamp>/summary.json
artifacts/rc-triage/<scope>/<timestamp>/summary.md
artifacts/rc-triage/<scope>/latest.json
artifacts/rc-triage/<scope>/latest.md
```

在 GitHub Actions 中，Markdown 同时追加到 `GITHUB_STEP_SUMMARY`。

### Workflow 行为

复用 Action：

```yaml
- name: Aggregate RC diagnostics
  if: always()
  uses: ./.github/actions/rc-diagnostic-triage
  with:
    scope: ci-build-test
    artifact-name: rc-triage-ci-build-test
    external-status: ${{ job.status }}
```

该步骤必须位于业务测试之后并使用 `if: always()`。即使依赖安装、Gate、数据库或浏览器步骤失败，聚合器仍会运行并上传修复清单。

### 边界

聚合器不会推断未运行测试已经通过，不会自动创建 Issue、修改代码、重新运行 Workflow、合并 PR 或发布候选版本。它只根据实际存在的诊断和显式 Job 状态生成可追踪的修复顺序。

## English

### Goal

RC stages emit separate environment, dependency, core-gate, Workflow-drift, security, database, browser, and five-stack runtime diagnostics. `rc:triage` combines those reports into one stable JSON and Markdown remediation plan so the first real run does not require manually downloading and comparing every artifact.

### Commands

```bash
pnpm rc:triage:plan
pnpm rc:triage
pnpm rc:triage:strict
```

Zero-dependency equivalent:

```bash
node scripts/rc-triage.mjs \
  --source-root=artifacts \
  --report-dir=artifacts/rc-triage/local \
  --scope=local \
  --allow-missing \
  --fail-on=blocking
```

### Priorities

| Priority | Meaning | Examples |
| --- | --- | --- |
| P0 | Stop the candidate immediately | security or integrity failure, Runner isolation policy failure, Workflow Bootstrap bypass, package-integrity failure |
| P1 | Release blocker | typecheck, build, unit, database, Redis, browser, five-stack runtime, frozen-lockfile, or offline-Store failure |
| P2 | Quality issue to fix before RC | lint, bilingual docs, bundle budget, prompt dry-run, temporary Registry outage |
| P3 | Advisory or incomplete coverage | optional tool or report missing, low-risk environment warning |

P0 and P1 findings are blocking by default. `--fail-on=blocking` exits non-zero when blockers exist; `--fail-on=never` only writes reports.

### Inputs

The script recursively reads candidate JSON files below `--source-root`:

- `latest.json`
- `summary.json`
- `report.json`
- `result.json`
- `security-audit.json`

It currently recognizes preflight, dependency, gate, Workflow Bootstrap, security, runtime-matrix, and generic failed reports.

External GitHub Job statuses can be supplied repeatedly:

```bash
--external-status=browser-quality:failure
--external-status=mysql-integration:success
```

### Deduplication and ownership

A problem appearing in both a timestamped report and `latest.json` is retained once, with the higher priority preserved. Every finding contains its priority, blocking state, stable code, evidence path, recommended action, and default owner domain.

### Outputs

```text
artifacts/rc-triage/<scope>/<timestamp>/summary.json
artifacts/rc-triage/<scope>/<timestamp>/summary.md
artifacts/rc-triage/<scope>/latest.json
artifacts/rc-triage/<scope>/latest.md
```

In GitHub Actions, the Markdown is also appended to `GITHUB_STEP_SUMMARY`.

### Workflow behavior

Reusable action:

```yaml
- name: Aggregate RC diagnostics
  if: always()
  uses: ./.github/actions/rc-diagnostic-triage
  with:
    scope: ci-build-test
    artifact-name: rc-triage-ci-build-test
    external-status: ${{ job.status }}
```

Place it after business checks with `if: always()` so dependency, gate, database, or browser failures still produce a remediation artifact.

### Boundary

The aggregator never treats unexecuted tests as passed. It does not create issues, edit code, rerun Workflows, merge the PR, or publish a release candidate. It only prioritizes evidence that actually exists together with explicitly supplied Job results.
