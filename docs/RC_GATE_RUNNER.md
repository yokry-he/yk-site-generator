# RC 门禁执行器 / RC Gate Runner

[中文](#中文) · [English](#english)

## 中文

### 目标

RC 门禁执行器把全仓静态门禁收敛为一个可重复运行的入口，并为每个步骤保存脱敏日志。默认行为不是在第一个失败处停止，而是尽可能执行完同一 Profile 的全部门禁，便于一次修复多项问题。

### 命令

```bash
pnpm rc:gates -- --profile=core
pnpm rc:gates -- --profile=full
pnpm rc:gates:plan
```

`core` 包含 Lint、双语文档、生成完整性、安全审计、Golden Project 锁、Runner 镜像策略、Typecheck、Build、Bundle 预算、Prompt dry-run 和单元测试。

`full` 在 `core` 基础上增加 IndexedDB 历史恢复、Playwright 浏览器／无障碍和视觉回归。运行 `full` 前需要安装 Chromium。

可选参数：

- `--only=lint,typecheck`：只运行指定 Gate。
- `--skip=prompt-quality`：跳过指定 Gate。
- `--fail-fast`：第一个失败后停止。
- `--report-dir=path`：覆盖报告目录。
- `--plan`：只显示执行计划。

### 诊断输出

每次运行写入：

```text
artifacts/rc-gates/<timestamp>/<gate>.log
artifacts/rc-gates/<timestamp>/summary.json
artifacts/rc-gates/<timestamp>/summary.md
artifacts/rc-gates/latest.json
artifacts/rc-gates/latest.md
```

日志会脱敏环境变量中的 Secret、Token、密码、API Key、Bearer Token、URL 凭据和常见 Secret 查询参数。报告只保存命令、状态、持续时间、退出码、信号和日志路径，不保存完整环境变量。

### CI 边界

普通 CI 的核心 Job 使用 `core` Profile。浏览器、MySQL、PostgreSQL、Redis 和五栈真实运行矩阵继续使用独立 Job，避免把外部服务故障混入静态门禁报告。

该执行器只能改善执行一致性和诊断，不能证明当前分支已经通过门禁。只有真实执行并产生成功报告后，才能把对应 Gate 标记为通过。

## English

### Goal

The RC gate runner consolidates repository-wide static gates behind one repeatable entry point and stores a redacted log for every step. By default it does not stop at the first failure; it attempts every gate in the selected profile so multiple issues can be fixed from one run.

### Commands

```bash
pnpm rc:gates -- --profile=core
pnpm rc:gates -- --profile=full
pnpm rc:gates:plan
```

`core` includes lint, bilingual documentation, generation integrity, security audit, Golden Project locks, Runner image policy, type checking, builds, bundle budget, prompt dry-run, and unit tests.

`full` adds IndexedDB history recovery, Playwright browser/accessibility tests, and visual regression. Chromium must be installed before running `full`.

Optional arguments:

- `--only=lint,typecheck`: run only selected gates.
- `--skip=prompt-quality`: skip selected gates.
- `--fail-fast`: stop after the first failure.
- `--report-dir=path`: override the report directory.
- `--plan`: print the execution plan only.

### Diagnostic output

Every run writes:

```text
artifacts/rc-gates/<timestamp>/<gate>.log
artifacts/rc-gates/<timestamp>/summary.json
artifacts/rc-gates/<timestamp>/summary.md
artifacts/rc-gates/latest.json
artifacts/rc-gates/latest.md
```

Logs redact environment Secret, Token, password, API Key values, Bearer tokens, URL credentials, and common secret query parameters. Reports store commands, status, duration, exit code, signal, and log paths, never the complete environment.

### CI boundary

The main CI job uses the `core` profile. Browser, MySQL, PostgreSQL, Redis, and real five-stack runtime matrices remain separate jobs so external-service failures do not get mixed into static-gate diagnostics.

The runner improves consistency and diagnostics but does not prove the current branch passes the gates. A gate is only passed after a real execution produces successful evidence.
