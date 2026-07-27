# RC 依赖引导与诊断 / RC Dependency Bootstrap and Diagnostics

[中文](#中文) · [English](#english)

## 中文

### 目标

RC 门禁在运行前必须完成可重复的冻结依赖安装。`pnpm rc:deps` 将网络获取与本地安装拆分为两个阶段，使 Registry 故障、锁文件不一致、Store 缺包和生命周期脚本失败可以被分别识别。

### 命令

```bash
pnpm rc:deps:plan
pnpm rc:deps:fetch
pnpm rc:deps:install
pnpm rc:deps
```

`rc:deps` 的顺序为：

```text
pnpm fetch --reporter=ndjson
pnpm install --offline --frozen-lockfile --reporter=ndjson
```

`fetch` 只根据锁文件填充 pnpm Store。随后 `install --offline` 禁止访问 Registry；如果 Store 不完整，安装立即失败，而不是在安装阶段悄悄访问网络。

### 重试规则

默认只对 `fetch` 阶段执行最多两次尝试。只有 Registry、DNS、连接超时、HTTP 429 或 HTTP 5xx 被视为可重试错误。以下问题不会重试：

- 锁文件与 Manifest 不一致
- Tarball 完整性失败
- Offline Store 缺包
- 磁盘空间不足
- 文件权限错误
- 生命周期脚本失败
- Peer Dependency 冲突

可以通过 `--attempts=1..4` 和 `--base-delay-ms=<毫秒>` 调整外层重试。pnpm 自己的 Registry 重试仍然保留。

### 诊断输出

```text
artifacts/rc-dependencies/<timestamp>/fetch-attempt-1.log
artifacts/rc-dependencies/<timestamp>/install-attempt-1.log
artifacts/rc-dependencies/<timestamp>/summary.json
artifacts/rc-dependencies/<timestamp>/summary.md
artifacts/rc-dependencies/latest.json
artifacts/rc-dependencies/latest.md
```

失败分类包括：

- `REGISTRY_UNAVAILABLE`
- `LOCKFILE_OUT_OF_SYNC`
- `TARBALL_INTEGRITY_FAILURE`
- `OFFLINE_STORE_INCOMPLETE`
- `LIFECYCLE_SCRIPT_FAILURE`
- `DISK_SPACE_EXHAUSTED`
- `FILESYSTEM_PERMISSION_DENIED`
- `PEER_DEPENDENCY_CONFLICT`
- `UNKNOWN_DEPENDENCY_FAILURE`

日志会脱敏环境 Secret、Bearer Token、URL 凭据和常见认证查询参数。

### CI 策略

Node 和 pnpm 设置完成后，CI 先运行零依赖环境预检，再执行依赖引导。`actions/setup-node` 使用 `pnpm-lock.yaml` 作为缓存键；依赖引导产生的诊断始终上传。核心门禁只有在离线冻结安装成功后才会运行。

### 边界

该流程不能让不可用的 Registry 变为可用，也不会自动修改锁文件、绕过 Tarball 完整性错误或执行 `--fix-lockfile`。依赖失败必须按分类处理，不能用非冻结安装掩盖。

## English

### Goal

RC gates require a repeatable frozen dependency installation. `pnpm rc:deps` separates network fetching from local installation so registry outages, lockfile drift, missing Store content, and lifecycle failures are diagnosed independently.

### Commands

```bash
pnpm rc:deps:plan
pnpm rc:deps:fetch
pnpm rc:deps:install
pnpm rc:deps
```

`rc:deps` runs:

```text
pnpm fetch --reporter=ndjson
pnpm install --offline --frozen-lockfile --reporter=ndjson
```

`fetch` populates the pnpm Store from the lockfile. The following offline install is forbidden from contacting a registry; an incomplete Store fails immediately rather than silently returning to the network during installation.

### Retry policy

Only the fetch phase is attempted twice by default. Registry, DNS, connection timeout, HTTP 429, and HTTP 5xx failures are retryable. Lockfile drift, integrity failures, missing offline packages, disk exhaustion, permissions, lifecycle scripts, and peer conflicts are not retried.

Use `--attempts=1..4` and `--base-delay-ms=<milliseconds>` to adjust the outer retry. pnpm's own registry retry behavior remains enabled.

### Diagnostics

Every attempt writes a redacted log plus JSON and Markdown summaries under `artifacts/rc-dependencies`. The report classifies registry, lockfile, integrity, Store, lifecycle, disk, permission, peer, and unknown failures without exposing credentials.

### CI policy

After Node and pnpm setup, CI runs the zero-dependency environment preflight and then dependency bootstrap. `actions/setup-node` keys the pnpm cache from `pnpm-lock.yaml`; dependency diagnostics are always uploaded. Core gates run only after the frozen offline install succeeds.

### Boundary

This workflow does not make an unavailable registry healthy, modify the lockfile, bypass tarball integrity failures, or run `--fix-lockfile`. Dependency failures must be resolved by category rather than hidden with a non-frozen install.
