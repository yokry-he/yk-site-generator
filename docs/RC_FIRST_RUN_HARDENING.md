# 首轮 RC 执行加固 / First-Run RC Hardening

[中文](#中文) · [English](#english)

## 中文

### 目标

本阶段审计并加固 `RC First Real Run`，防止旧诊断、重复门禁或不受信任的 PR 触发污染首轮真实执行结果。它不把静态检查描述为真实通过，也不改变 `0.1.0-rc.1` 的发布门禁集合。

### 证据隔离

每个 Profile 在 Workstation 镜像指纹之后、服务启动之前执行 `evidence-reset`。该阶段只清理共享生成目录：

- `artifacts/rc-preflight`
- `artifacts/rc-dependencies`
- `artifacts/rc-gates`
- `artifacts/rc-workflow-bootstrap`
- `artifacts/rc-triage`
- `artifacts/rc-matrix`
- `artifacts/golden-projects`
- 安全审计、Prompt 报告和 Playwright 输出

`artifacts/rc-first-run` 不会被删除，因此当前运行的状态、日志、镜像指纹和断点恢复数据保持完整。

断点恢复从 `evidence-reset` 重新开始，不重复构建已经成功的 Workstation 镜像，但会重新生成本次尝试使用的全部门禁证据。

### 增量 Full Gate

`core-gates` 已经运行 Core Profile。后续 `full-gates` 只执行：

```text
history
browser
visual
```

对应命令：

```bash
pnpm rc:gates:full --only=history,browser,visual
```

这避免在同一首轮执行中重复运行 Lint、Typecheck、Build、Unit、Golden 和安全门禁。

### Triage 范围

`rc-triage.mjs` 新增可重复的 `--exclude=<relative-path>` 参数。首轮内部 Triage 和 GitHub Job 末尾的共享 Triage Action 都排除 `rc-first-run`，因此不会把仍处于 `running` 状态的 `latest.json` 当成门禁诊断，也不会读取旧运行状态。

共享 `rc-diagnostic-triage` Action 接受逗号分隔的相对路径，并拒绝包含非安全字符的排除值。

### Redis 数据隔离

两个 Redis Smoke API 实例的数据文件写入当前运行目录：

```text
artifacts/rc-first-run/<run-id>/runtime/redis-a.json
artifacts/rc-first-run/<run-id>/runtime/redis-b.json
```

不同运行不再共享固定 `.data/first-run-redis-*.json`，避免旧验证码失败次数、Session 或账号状态影响新运行。

### 镜像指纹

Workstation 指纹阶段现在输出有效的 `docker image inspect` JSON，并同时记录以下输入的 SHA-256：

- `infra/rc-workstation/Dockerfile`
- `infra/rc-workstation/compose.yml`
- `infra/rc-workstation/images.lock.json`

### 标签触发边界

`rc-first-run` 标签只允许触发：

- PR #44
- 同一 GitHub 仓库的 Head
- `Feature-dev-v0.1.0` 分支

Fork PR、其他 PR 或其他分支即使使用相同标签，也不会执行 Workstation 中的 PR 代码。

### 当前验证边界

已完成 Node 语法检查、九个首轮契约测试、Triage CLI 排除测试、JSON/YAML 解析、远端差异审计和 `[skip ci]` 检查。当前环境没有 Docker、pnpm 和可用 Registry，因此尚未真实构建或运行 Workstation。

## English

### Goal

This stage audits and hardens `RC First Real Run` so stale diagnostics, duplicate gates, or untrusted pull-request triggers cannot contaminate the first real execution. It does not represent static checks as runtime success and does not change the required gates for `0.1.0-rc.1`.

### Evidence isolation

Every profile runs `evidence-reset` after the Workstation image fingerprint and before services start. It removes only shared generated directories:

- `artifacts/rc-preflight`
- `artifacts/rc-dependencies`
- `artifacts/rc-gates`
- `artifacts/rc-workflow-bootstrap`
- `artifacts/rc-triage`
- `artifacts/rc-matrix`
- `artifacts/golden-projects`
- security, prompt, and Playwright outputs

`artifacts/rc-first-run` is preserved, so the current state, logs, image fingerprint, and resume data remain intact.

A resumed run restarts from `evidence-reset`. It does not rebuild an already successful Workstation image, but it regenerates all gate evidence used by the new attempt.

### Incremental Full Gate

`core-gates` already runs the Core Profile. The later `full-gates` stage now runs only:

```text
history
browser
visual
```

using:

```bash
pnpm rc:gates:full --only=history,browser,visual
```

This avoids rerunning lint, typecheck, build, unit, Golden, and security gates in the same first-run execution.

### Triage scope

`rc-triage.mjs` now accepts repeatable `--exclude=<relative-path>` arguments. Both the internal first-run Triage and the shared GitHub Triage Action exclude `rc-first-run`, so an in-progress `latest.json` is not treated as a gate diagnostic and stale run states are not ingested.

The shared `rc-diagnostic-triage` Action accepts comma-separated relative paths and rejects exclusions containing unsafe characters.

### Redis data isolation

The two Redis Smoke API instances write their storage files beneath the current run:

```text
artifacts/rc-first-run/<run-id>/runtime/redis-a.json
artifacts/rc-first-run/<run-id>/runtime/redis-b.json
```

Runs no longer share fixed `.data/first-run-redis-*.json` files, preventing old verification failures, sessions, or account state from affecting a new run.

### Image fingerprint

The Workstation fingerprint stage now writes valid `docker image inspect` JSON and records SHA-256 checksums for:

- `infra/rc-workstation/Dockerfile`
- `infra/rc-workstation/compose.yml`
- `infra/rc-workstation/images.lock.json`

### Label-trigger boundary

The `rc-first-run` label may trigger only:

- pull request 44
- a head repository equal to the current repository
- branch `Feature-dev-v0.1.0`

A fork, another pull request, or another branch cannot execute its PR code in the Workstation merely by using the same label.

### Current validation boundary

Completed checks include Node syntax validation, nine first-run contract tests, the Triage CLI exclusion test, JSON/YAML parsing, remote diff review, and `[skip ci]` verification. Docker, pnpm, and a usable Registry are unavailable in the current environment, so the Workstation has not been built or executed yet.
