# RC Workflow Bootstrap 收敛 / RC Workflow Bootstrap Consolidation

[中文](#中文) · [English](#english)

## 中文

### 目标

`.github/actions/rc-node-bootstrap/action.yml` 是所有 Node.js／pnpm Workflow 的唯一初始化入口。它统一执行：

1. 安装 pnpm 11；
2. 安装 Node.js 24；
3. 使用 `pnpm-lock.yaml` 作为 pnpm Store 缓存键；
4. 执行 RC 环境预检；
5. 执行预检和依赖引导的零依赖单元测试；
6. 根据锁文件执行 Store 获取和冻结离线安装；
7. 无论成功或失败都上传预检与依赖诊断。

### 使用

```yaml
- uses: ./.github/actions/rc-node-bootstrap
  with:
    preflight-profile: core
    dependency-mode: all
    dependency-attempts: '2'
    artifact-name: rc-bootstrap-build-test
```

`artifact-name` 必须在同一 Workflow 内唯一。矩阵 Job 应把矩阵键加入名称。

### 支持的输入

- `preflight-profile`: `core`、`full`、`release` 或 `none`
- `dependency-mode`: `all`、`fetch`、`install` 或 `none`
- `dependency-attempts`: Registry 可重试错误的 Fetch 次数
- `run-self-tests`: 是否运行零依赖内置测试
- `artifact-name`: 预检和依赖诊断 Artifact 名称

### 漂移门禁

```bash
pnpm rc:workflow-bootstrap
```

该命令扫描 `.github/workflows/*.yml` 和 `.yaml`，并阻断：

- Node／pnpm Workflow 未使用共享 Bootstrap；
- Workflow 直接调用 `pnpm/action-setup`；
- Workflow 直接调用 `actions/setup-node`；
- Workflow 重新出现 `pnpm install`；
- Workflow 直接调用 `install-rc-dependencies.mjs`；
- Bootstrap 调用缺少 `artifact-name`。

报告写入：

```text
artifacts/rc-workflow-bootstrap/latest.json
artifacts/rc-workflow-bootstrap/latest.md
```

### 边界

该收敛减少 Workflow 配置漂移，但不会证明 Registry、pnpm Store、依赖生命周期脚本或全仓门禁已经真实通过。真实结论仍必须来自 Workflow Run 和对应诊断 Artifact。

## English

### Goal

`.github/actions/rc-node-bootstrap/action.yml` is the single initialization entry point for every Node.js/pnpm workflow. It consistently:

1. installs pnpm 11;
2. installs Node.js 24;
3. keys the pnpm Store cache with `pnpm-lock.yaml`;
4. runs the RC environment preflight;
5. runs zero-dependency preflight and dependency-bootstrap tests;
6. fetches from the lockfile and performs a frozen offline install;
7. uploads preflight and dependency diagnostics whether the bootstrap succeeds or fails.

### Usage

```yaml
- uses: ./.github/actions/rc-node-bootstrap
  with:
    preflight-profile: core
    dependency-mode: all
    dependency-attempts: '2'
    artifact-name: rc-bootstrap-build-test
```

`artifact-name` must be unique within the workflow. Matrix jobs should include the matrix key in the name.

### Inputs

- `preflight-profile`: `core`, `full`, `release`, or `none`
- `dependency-mode`: `all`, `fetch`, `install`, or `none`
- `dependency-attempts`: fetch attempts for retryable registry failures
- `run-self-tests`: whether to run the zero-dependency built-in tests
- `artifact-name`: artifact name for preflight and dependency diagnostics

### Drift gate

```bash
pnpm rc:workflow-bootstrap
```

The command scans `.github/workflows/*.yml` and `.yaml` and blocks:

- Node/pnpm workflows that do not use the shared bootstrap;
- direct `pnpm/action-setup` usage in workflows;
- direct `actions/setup-node` usage in workflows;
- reintroduced `pnpm install` commands;
- direct workflow calls to `install-rc-dependencies.mjs`;
- bootstrap uses without an `artifact-name` input.

Reports are written to:

```text
artifacts/rc-workflow-bootstrap/latest.json
artifacts/rc-workflow-bootstrap/latest.md
```

### Boundary

This consolidation reduces workflow configuration drift, but it does not prove that the registry, pnpm Store, dependency lifecycle scripts, or repository gates have passed in a real run. Those conclusions still require workflow runs and their diagnostic artifacts.
