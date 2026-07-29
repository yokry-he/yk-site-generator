# 首轮 RC 证据封存 / First-Run RC Evidence Sealing

[中文](#中文) · [English](#english)

## 中文

### 目标

首轮真实运行会产生环境预检、依赖安装、核心门禁、浏览器测试、数据库矩阵、Golden Runtime、Triage 和阶段日志。证据封存把这些文件与同一个 Commit、Profile 和运行状态绑定，并为每个文件生成 SHA-256。

这套封存用于发现文件在运行结束后被修改、删除或替换。它不是数字签名，也不能替代 `RC_EVIDENCE_SIGNING_KEY` 生成的可信发布证据。

### 干净数据卷

每个 Profile 在启动数据库前执行：

```text
workstation-fingerprint
→ evidence-reset
→ services-reset
→ services-up
```

`services-reset` 使用：

```bash
docker compose -f infra/rc-workstation/compose.yml down --volumes --remove-orphans
```

因此 MySQL、PostgreSQL、Redis 以及工具缓存不会从上一次首轮运行继承状态。最终 `services-down` 也删除本次运行创建的卷。

普通 `rc:workstation:*` 开发命令仍保留缓存卷；严格清理只属于 Commit 绑定的首轮运行。

### Commit 传播

编排器在校验当前 Git Commit 后设置：

```text
CI_COMMIT_SHA=<40-character commit SHA>
```

所有 `docker compose run` Workstation 阶段显式继承该变量。支持 Commit 字段的依赖、门禁和诊断报告因此会记录同一 SHA。

### 封存流程

所有业务阶段、Triage 和容器清理结束后，编排器：

1. 确定最终运行状态；
2. 写入不可变状态快照 `sealed-state.json`；
3. 检查每个阶段尝试引用的日志真实存在；
4. 拒绝符号链接和不安全相对路径；
5. 对运行输入、日志和诊断产物逐文件计算 SHA-256；
6. 写入 `evidence-manifest.json` 和 `SHA256SUMS`；
7. 把 Manifest 路径和 Manifest SHA-256 写回活动状态文件。

每次阶段重试使用独立日志：

```text
<stage>.attempt-1.log
<stage>.attempt-2.log
```

旧尝试不会被新尝试覆盖。

### 封存范围

Manifest 可包含：

- `release/rc-first-run-plan.json`
- `release/rc-manifest.json`
- Workstation Dockerfile、Compose 和镜像锁
- Workstation 镜像 Inspect 结果及输入校验和
- `sealed-state.json`
- 全部阶段尝试日志
- 环境预检与依赖诊断
- Core／Full Gate 报告
- Workflow Bootstrap 报告
- 安全审计与 Prompt 报告
- 数据库和 Golden Runtime 日志
- 当前运行的 Triage 报告
- Playwright 报告和测试结果

封存器最多接受 20,000 个文件，避免异常目录导致无限制 Manifest。

### 输出

```text
artifacts/rc-first-run/<run-id>/sealed-state.json
artifacts/rc-first-run/<run-id>/evidence-manifest.json
artifacts/rc-first-run/<run-id>/SHA256SUMS
```

`evidence-manifest.json` 包含：

- Run ID
- Candidate Version
- Profile
- 完整 Commit SHA
- 最终状态
- 封存时间
- 文件数量
- 每个文件的相对路径、字节数和 SHA-256

`SHA256SUMS` 的第一行记录 Manifest 自身的 SHA-256，其余行与 Manifest 中排序后的文件列表完全一致。

### 验证

验证最近一次运行：

```bash
pnpm rc:first-run:verify
```

验证器会重新计算全部文件的大小和 SHA-256，并检查：

- Manifest Schema 和算法
- Run ID
- 文件计数和路径排序
- 重复或不安全路径
- 缺失文件
- Digest 或字节数变化
- `SHA256SUMS` 与 Manifest 完全一致
- `sealed-state.json` 与 Manifest 的 Commit、Profile 和状态一致

GitHub 首轮 Workflow 在 Artifact 上传前无条件执行同一验证。如果编排过程未产生封存文件，或任一文件已变化，Job 会保持失败。

### 信任边界

SHA-256 清单可以证明“下载到的文件集合与封存时一致”，但不能证明是谁创建了该集合。只有阶段九的 HMAC 签名证据和人工批准流程可以作为候选发布的可信签名链。

在 `v0.1.0-rc.1` 发布前，应同时满足：

- 首轮封存验证通过；
- Triage 没有 P0／P1；
- GitHub Actions 证据绑定同一 Commit；
- 签名 RC Bundle 验证通过。

## English

### Goal

The first real run produces environment preflight, dependency installation, core gates, browser tests, database matrices, Golden Runtimes, triage reports, and stage logs. Evidence sealing binds those files to one commit, profile, and run state and calculates a SHA-256 digest for every included file.

The seal detects files that are modified, deleted, or replaced after execution. It is not a digital signature and does not replace trusted release evidence generated with `RC_EVIDENCE_SIGNING_KEY`.

### Clean volumes

Every profile now executes this sequence before starting databases:

```text
workstation-fingerprint
→ evidence-reset
→ services-reset
→ services-up
```

`services-reset` runs:

```bash
docker compose -f infra/rc-workstation/compose.yml down --volumes --remove-orphans
```

MySQL, PostgreSQL, Redis, and tool caches therefore cannot inherit state from an earlier first run. The final `services-down` stage also removes volumes created by the current run.

Normal `rc:workstation:*` development commands still preserve caches. Strict volume removal applies only to commit-bound first runs.

### Commit propagation

After validating the current Git commit, the orchestrator sets:

```text
CI_COMMIT_SHA=<40-character commit SHA>
```

Every Workstation `docker compose run` stage explicitly inherits this variable. Dependency, gate, and diagnostic reports that support commit metadata therefore record the same SHA.

### Sealing process

After business stages, triage, and container cleanup finish, the orchestrator:

1. determines the final run status;
2. writes an immutable `sealed-state.json` snapshot;
3. verifies that every referenced stage-attempt log exists;
4. rejects symbolic links and unsafe relative paths;
5. calculates SHA-256 for run inputs, logs, and diagnostics;
6. writes `evidence-manifest.json` and `SHA256SUMS`;
7. records the manifest path and manifest SHA-256 in the active state file.

Each retry receives a distinct log name:

```text
<stage>.attempt-1.log
<stage>.attempt-2.log
```

A later attempt cannot overwrite an earlier attempt.

### Sealed content

The manifest may include:

- the first-run plan and RC manifest;
- Workstation Dockerfile, Compose file, and image lock;
- Workstation image inspection and input checksums;
- `sealed-state.json`;
- every stage-attempt log;
- preflight and dependency diagnostics;
- core and full gate reports;
- Workflow Bootstrap reports;
- security and prompt reports;
- database and Golden Runtime logs;
- the current run's triage report;
- Playwright reports and test results.

The sealer accepts at most 20,000 files so an unexpected directory cannot create an unbounded manifest.

### Output

```text
artifacts/rc-first-run/<run-id>/sealed-state.json
artifacts/rc-first-run/<run-id>/evidence-manifest.json
artifacts/rc-first-run/<run-id>/SHA256SUMS
```

The manifest records the run ID, candidate version, profile, full commit SHA, final status, sealing time, file count, and each file's relative path, byte count, and SHA-256.

The first `SHA256SUMS` line records the manifest's own SHA-256. Remaining lines exactly match the manifest's sorted file list.

### Verification

Verify the latest run with:

```bash
pnpm rc:first-run:verify
```

The verifier recalculates sizes and digests and checks the schema, algorithm, run ID, file count, path ordering, duplicate or unsafe paths, missing files, digest changes, exact `SHA256SUMS` consistency, and consistency between `sealed-state.json` and the manifest.

The GitHub first-run workflow always performs the same verification before artifact upload. A missing seal or changed file keeps the job failed.

### Trust boundary

A SHA-256 manifest proves that the downloaded file set matches the set present at sealing time. It does not prove who created that set. Only the stage-nine HMAC-signed evidence and human approval flow form the trusted release-signing chain.

Before publishing `v0.1.0-rc.1`, require a valid first-run seal, no P0/P1 triage findings, GitHub Actions evidence for the same commit, and a valid signed RC bundle.
