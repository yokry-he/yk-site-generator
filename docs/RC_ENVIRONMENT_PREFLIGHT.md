# RC 环境预检 / RC Environment Preflight

[中文](#中文) · [English](#english)

## 中文

### 目标

`node scripts/rc-preflight.mjs` 是一个零 Workspace 依赖的发布候选环境检查器。它可以在 `pnpm install` 之前运行，用于区分“仓库配置错误”和“当前主机工具链未准备好”，避免把安装失败、脚本缺失或版本漂移混在后续 Lint、Typecheck 与测试日志里。

### 命令

```bash
pnpm rc:preflight
pnpm rc:preflight:full
pnpm rc:preflight:release
```

也可以在尚未安装依赖时直接运行：

```bash
node scripts/rc-preflight.mjs --profile=core
```

### 检查内容

Core Profile 会检查：

- Node.js 至少为 20，RC 基线建议 Node.js 24
- 根 `package.json` 固定 `pnpm@11.x`
- `pnpm-lock.yaml` 使用 lockfileVersion `9.0`
- Workspace 包含 `apps/*` 和 `packages/*`
- Web、Server、Shared、Prompts 和根工程的必需脚本存在
- CI、RC Release、Golden Manifest 和 RC Manifest 等关键文件存在
- 当前主机可执行 `pnpm` 且主版本为 11

Full Profile 额外检查 Playwright 浏览器缓存。Release Profile 还会报告 Docker、Python、Go、Java、Maven、PostgreSQL CLI 和 Redis CLI 的可用性。Release 外部工具缺失默认记为 Warning，因为这些工具可以分布在独立 CI Job；使用 `--strict-warnings` 可将 Warning 转为失败。

### 输出

```text
artifacts/rc-preflight/latest.json
artifacts/rc-preflight/latest.md
```

报告只包含工具版本、文件路径和问题代码，不输出 Secret 或连接凭据。

### CI 顺序

普通 CI 在安装依赖前运行一次零依赖预检；依赖安装完成后，`pnpm rc:gates:core` 会把 `pnpm rc:preflight` 作为第一个 Gate 再运行一次，并同时执行预检自身的 Node 内置单元测试。

### 边界

环境预检不能证明依赖可安装，也不能替代 Lint、Typecheck、Build、Vitest、Playwright、数据库或五栈运行矩阵。它只负责在昂贵门禁开始前发现确定性的环境和仓库配置错误。

## English

### Goal

`node scripts/rc-preflight.mjs` is a release-candidate environment checker with no workspace dependency. It can run before `pnpm install` to separate repository configuration errors from host-toolchain readiness problems, keeping installation failures, missing scripts, and version drift out of later lint, typecheck, and test logs.

### Commands

```bash
pnpm rc:preflight
pnpm rc:preflight:full
pnpm rc:preflight:release
```

Before dependencies are installed, run it directly:

```bash
node scripts/rc-preflight.mjs --profile=core
```

### Checks

The Core profile verifies:

- Node.js 20 or newer, with Node.js 24 as the RC baseline
- root `package.json` pins `pnpm@11.x`
- `pnpm-lock.yaml` uses lockfileVersion `9.0`
- the workspace includes `apps/*` and `packages/*`
- required root, Web, Server, Shared, and Prompts scripts exist
- critical CI, RC Release, Golden Manifest, and RC Manifest files exist
- the host can execute pnpm and its major version is 11

The Full profile also checks the Playwright browser cache. The Release profile reports the availability of Docker, Python, Go, Java, Maven, PostgreSQL CLI, and Redis CLI. Missing release tools are warnings by default because they may live in separate CI jobs; `--strict-warnings` turns warnings into failures.

### Output

```text
artifacts/rc-preflight/latest.json
artifacts/rc-preflight/latest.md
```

Reports contain tool versions, paths, and issue codes only. They do not print secrets or connection credentials.

### CI order

Normal CI runs the dependency-free preflight before installation. After dependencies are installed, `pnpm rc:gates:core` runs `pnpm rc:preflight` again as its first gate and also executes the preflight's Node built-in unit tests.

### Boundary

Preflight does not prove that dependencies install successfully and does not replace lint, typecheck, build, Vitest, Playwright, database, or five-stack runtime gates. It only detects deterministic environment and repository configuration failures before expensive gates begin.
