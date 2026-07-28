# SiteForge 首轮真实 RC 执行 / First Real RC Run

[中文](#中文) · [English](#english)

## 中文

### 目标

阶段十六不再增加横向产品能力，而是把同一个 Git Commit 放入可复现 Workstation 中，真实运行依赖安装、核心门禁、浏览器门禁、MySQL、Redis 和五套 Golden Runtime。所有阶段写入可恢复状态文件，禁止跨 Commit 拼接结果。

### 本地执行入口

```bash
pnpm rc:first-run:plan
pnpm rc:first-run:core
pnpm rc:first-run:full
pnpm rc:first-run:release
```

严格绑定 Commit：

```bash
node scripts/rc-first-run.mjs \
  --profile=release \
  --expected-commit="$(git rev-parse HEAD)"
```

恢复同一 Commit 的失败运行（超过 48 小时需要显式 `--allow-stale-resume`）：

```bash
node scripts/rc-first-run.mjs --profile=release --resume=latest
```

### GitHub 执行入口

`.github/workflows/rc-first-real-run.yml` 支持两种触发方式：

1. Workflow 已存在于默认分支后，通过 `workflow_dispatch` 选择 `core`、`full` 或 `release`。
2. 当前长期 PR 尚未合并时，在 **GitHub Actions 额度恢复后**给 PR #44 添加 `rc-first-run` 标签。`pull_request:labeled` 会检出 PR Head SHA，并运行 `release` Profile。

在 2026-08-01 额度恢复前不要添加该标签。Workflow 使用 360 分钟上限、禁止并发取消，并把期望 Commit 绑定到 PR Head SHA 或手动输入 SHA。

### Release 执行顺序

1. 首轮执行契约与 Workstation 静态策略
2. 构建 Workstation 镜像
3. 记录 Workstation 本地镜像 ID 与构建指纹
4. 启动并等待 MySQL、PostgreSQL、Redis
5. `pnpm fetch` 与冻结离线安装
6. Core Gate
7. MySQL 迁移、并发和回滚
8. Redis 双实例登录保护
9. 五套 Golden Runtime
10. Full Gate，包括浏览器、Axe 和视觉回归
11. 诊断聚合
12. 无条件关闭服务

`triage` 和 `services-down` 是 always-run 阶段。前序失败后，其他业务阶段停止，但仍会生成 P0–P3 修复清单并清理容器。

### Commit、工作区与文件权限

默认要求：

- 当前目录是 Git Checkout
- Commit 为完整 40 位 SHA
- 分支为 `Feature-dev-v0.1.0`
- 工作区没有未提交文件
- `--expected-commit` 与当前 Commit 完全一致

GitHub Actions 可以在 detached HEAD 下运行，但仍必须绑定 PR Head SHA 或 `GITHUB_SHA`。本地确需测试未提交代码时可显式使用 `--allow-dirty`；该结果不得作为 RC 证据。崩溃后遗留的运行锁只能通过显式 `--force-unlock` 清除。

编排器自动把非 root 宿主进程的 UID/GID 传入 Workstation Build Args，避免容器创建的 `0600` 报告无法被宿主 Triage 或 Artifact 上传读取。显式 `RC_WORKSTATION_UID` 和 `RC_WORKSTATION_GID` 优先；root 宿主回退到 10001。

### PostgreSQL 与 Redis 运行约束

Golden Runtime 不再固定连接 `127.0.0.1:5432`。以下变量控制数据库管理连接：

```text
RC_POSTGRES_HOST
RC_POSTGRES_PORT
RC_POSTGRES_USER
RC_POSTGRES_PASSWORD
RC_POSTGRES_ADMIN_DATABASE
RC_POSTGRES_DATABASE_PREFIX
```

Workstation 使用 `postgres:5432`；GitHub service-container Workflow 继续使用默认 `127.0.0.1:5432`。

Redis 阶段显式设置：

```text
AUTH_DISTRIBUTED_LIMIT_DRIVER=redis
AUTH_RATE_LIMIT_FAIL_MODE=closed
AUTH_MAX_VERIFY_FAILURES=3
AUTH_JWT_SECRET=<local placeholder>
AUTH_RATE_LIMIT_HASH_KEY=<local placeholder>
```

两个 API 实例共享同一个 Redis 与哈希 Secret，轮流接收四次失败验证；最后一次必须返回 HTTP 429，才算多实例锁定通过。

### 输出

```text
artifacts/rc-first-run/<run-id>/state.json
artifacts/rc-first-run/<run-id>/summary.md
artifacts/rc-first-run/<run-id>/workstation-image.json
artifacts/rc-first-run/<run-id>/logs/*.log
artifacts/rc-first-run/latest.json
artifacts/rc-first-run/latest.md
```

状态文件在每个阶段后原子更新，记录 Commit、Profile、宿主工具版本、Workstation UID/GID、阶段尝试、退出码、信号、持续时间和脱敏日志路径。并发执行由 `active.lock` 阻断。

### 完成标准

只有 Release Profile 的所有非清理阶段通过、Triage 成功生成、服务正常关闭，首轮运行状态才是 `passed`。静态验证、计划输出或未运行阶段不能记为真实通过。

## English

### Goal

Stage sixteen stops expanding product breadth. It runs dependency installation, core and browser gates, MySQL, Redis, and all five Golden Runtimes for one exact Git commit inside the reproducible Workstation. Every stage writes resumable state, and results from different commits cannot be combined.

### Local entry points

```bash
pnpm rc:first-run:plan
pnpm rc:first-run:core
pnpm rc:first-run:full
pnpm rc:first-run:release
```

Bind an exact commit:

```bash
node scripts/rc-first-run.mjs \
  --profile=release \
  --expected-commit="$(git rev-parse HEAD)"
```

Resume a failed run for the same commit; runs older than 48 hours require `--allow-stale-resume`:

```bash
node scripts/rc-first-run.mjs --profile=release --resume=latest
```

### GitHub entry points

`.github/workflows/rc-first-real-run.yml` supports two triggers:

1. After the workflow exists on the default branch, use `workflow_dispatch` and choose `core`, `full`, or `release`.
2. While the long-lived PR remains unmerged, add the `rc-first-run` label to PR #44 **after the GitHub Actions quota resets**. The `pull_request:labeled` event checks out the PR head SHA and runs the `release` profile.

Do not add the label before August 1, 2026. The workflow has a 360-minute limit, does not cancel an active run, and binds the expected commit to either the PR head SHA or the manually supplied SHA.

### Release order

1. Validate the first-run contract and Workstation policy
2. Build the Workstation image
3. Capture the local Workstation image ID and build fingerprint
4. Start and wait for MySQL, PostgreSQL, and Redis
5. Fetch dependencies and perform the frozen offline install
6. Run core gates
7. Run MySQL migration, concurrency, and rollback checks
8. Run Redis multi-instance login protection
9. Run all five Golden Runtimes
10. Run full gates, including browser, Axe, and visual regression
11. Aggregate diagnostics
12. Always stop services

`triage` and `services-down` are always-run stages. A business-stage failure stops later business work, while diagnostics and cleanup still execute.

### Commit, worktree, and ownership constraints

By default the runner requires a Git checkout, a full 40-character commit SHA, branch `Feature-dev-v0.1.0`, a clean worktree, and an exact `--expected-commit` match. GitHub Actions may use detached HEAD while remaining bound to the PR head SHA or `GITHUB_SHA`. `--allow-dirty` is for local investigation only and cannot produce trusted RC evidence. A stale active lock can be removed only with explicit `--force-unlock`.

The orchestrator automatically passes the non-root host process UID/GID into Workstation build arguments so container-created `0600` reports remain readable by host-side triage and artifact upload. Explicit `RC_WORKSTATION_UID` and `RC_WORKSTATION_GID` values take precedence; root hosts fall back to 10001.

### PostgreSQL and Redis runtime constraints

Golden Runtime no longer hard-codes `127.0.0.1:5432`. Database administration uses `RC_POSTGRES_HOST`, `RC_POSTGRES_PORT`, `RC_POSTGRES_USER`, `RC_POSTGRES_PASSWORD`, `RC_POSTGRES_ADMIN_DATABASE`, and `RC_POSTGRES_DATABASE_PREFIX`. The Workstation uses `postgres:5432`; existing service-container workflows keep the localhost defaults.

The Redis stage explicitly enables the Redis distributed limiter, fail-closed mode, a threshold of three, and shared local placeholder JWT/hash secrets. Two API instances share the same Redis and hash secret, receive four alternating failed verifications, and must return HTTP 429 on the final request.

### Output

```text
artifacts/rc-first-run/<run-id>/state.json
artifacts/rc-first-run/<run-id>/summary.md
artifacts/rc-first-run/<run-id>/workstation-image.json
artifacts/rc-first-run/<run-id>/logs/*.log
artifacts/rc-first-run/latest.json
artifacts/rc-first-run/latest.md
```

The Workstation image ID is captured in `workstation-image.json`. State is atomically updated after every stage and records the commit, profile, host tool versions, Workstation UID/GID, attempts, exit codes, signals, durations, and redacted log paths. `active.lock` prevents concurrent runs.

### Completion criteria

The run is `passed` only when every non-cleanup stage in the release profile passes, triage is generated successfully, and services are stopped successfully. Plans, static checks, and skipped stages are not real execution evidence.
