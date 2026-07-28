# RC Workstation / RC 工作站

[中文](#中文) · [English](#english)

## 中文

### 目标

RC Workstation 提供一套可复现的容器环境，用于执行 SiteForge 的完整 RC 门禁，而不要求开发机预先安装 Node.js、pnpm、Python、Go、Java、Maven、MySQL、PostgreSQL、Redis 或 Playwright 浏览器依赖。

它不会替代 GitHub Actions 的可信发布证据，也不会自动创建 Tag、合并 PR 或部署生产环境。它用于在正式 CI 前复现和修复问题。

### 组成

工具链容器包含：

- Node.js 24
- pnpm 11.0.0
- Python 3.14 与固定 uv
- Go 1.25
- Java 21 与 Maven 3.9
- 与仓库锁文件一致的 Playwright 1.61.1 系统环境
- PostgreSQL、MySQL 和 Redis 客户端

Compose 同时启动内部服务：

- MySQL 8.4
- PostgreSQL 17
- Redis 8

数据库服务只加入 `rc-internal` 内部网络，默认不向宿主机发布端口。只有 Workstation 同时加入内部网络和可访问 Registry 的 `rc-egress` 网络。

### 安全边界

静态门禁要求：

- 禁止 `privileged: true`
- 禁止 host network 和 host PID
- 禁止挂载 Docker socket
- 禁止数据库端口映射到宿主机
- 所有服务首先执行 `cap_drop: [ALL]`
- 非 root Workstation 不重新增加 Capability
- MySQL、PostgreSQL 和 Redis 仅重新增加 `CHOWN`、`DAC_OVERRIDE`、`FOWNER`、`SETGID`、`SETUID`，用于初始化命名卷并从 root EntryPoint 降权到服务账号
- 禁止 `ALL`、`SYS_ADMIN`、`NET_ADMIN`、`SYS_PTRACE` 等危险 Capability
- 所有服务启用 `no-new-privileges`
- 所有服务设置 PID 限制和健康检查
- Workstation 以非 root 用户运行，默认 UID/GID 为 10001
- 工具链基础镜像必须与 `images.lock.json` 一致
- Dockerfile 禁止 `curl | sh` 或 `curl | bash`

本地数据库密码只用于隔离的 Compose 网络，不得复制到生产环境。

### 命令

静态验证：

```bash
pnpm rc:workstation:validate
```

查看将执行的 Docker Compose 命令：

```bash
pnpm rc:workstation:plan
```

构建工具链镜像：

```bash
pnpm rc:workstation:build
```

启动数据库和 Redis：

```bash
pnpm rc:workstation:up
```

执行核心门禁：

```bash
pnpm rc:workstation:core
```

执行包含 Playwright、Axe 和视觉回归的完整门禁：

```bash
pnpm rc:workstation:full
```

打开交互式 Shell：

```bash
pnpm rc:workstation:shell
```

停止环境：

```bash
pnpm rc:workstation:down
```

### 文件权限

镜像默认使用 UID/GID 10001。Linux 主机可以在构建前对齐当前用户：

```bash
export RC_WORKSTATION_UID="$(id -u)"
export RC_WORKSTATION_GID="$(id -g)"
pnpm rc:workstation:build
```

`rc:first-run:*` 编排器会自动读取非 root 宿主进程的 UID/GID，并通过 Compose Build Args 传入容器；显式环境变量仍具有最高优先级。这样容器生成的 `0600` JSON、Markdown 和日志可以由宿主 Triage 与 Artifact 上传步骤读取。root 宿主进程会回退到 10001，避免与容器内已有 root 用户冲突。

### 缓存与数据

以下内容使用命名卷：

- pnpm Store
- Maven 本地仓库
- Go Cache
- uv Cache
- MySQL 数据
- PostgreSQL 数据
- Redis AOF 数据

源码目录直接挂载到 `/workspace`。执行 `docker compose down` 不会删除命名卷；需要完全清理时显式增加 `--volumes`，并确认不再需要本地测试数据。

### 验收标准

- `pnpm rc:workstation:validate` 通过
- Docker Compose 配置可解析
- Workstation 健康检查显示所有工具链可用
- MySQL、PostgreSQL 和 Redis 健康
- `rc:deps` 使用容器内 pnpm Store 完成冻结安装
- `rc:gates:core` 或 `rc:gates:full` 生成统一 Gate 与 Triage 报告
- 不向宿主机暴露数据库端口或 Docker socket

## English

### Goal

RC Workstation provides a reproducible container environment for running the complete SiteForge RC gates without requiring the host to preinstall Node.js, pnpm, Python, Go, Java, Maven, MySQL, PostgreSQL, Redis, or Playwright browser dependencies.

It does not replace trusted GitHub Actions release evidence and never creates tags, merges pull requests, or deploys production automatically. It exists to reproduce and repair failures before trusted CI.

### Components

The toolchain container includes:

- Node.js 24
- pnpm 11.0.0
- Python 3.14 with pinned uv
- Go 1.25
- Java 21 with Maven 3.9
- the Playwright 1.61.1 system environment matching the repository lockfile
- PostgreSQL, MySQL, and Redis clients

Compose also starts internal services:

- MySQL 8.4
- PostgreSQL 17
- Redis 8

Database services join only the internal `rc-internal` network and publish no host ports by default. Only the Workstation joins both the internal network and the Registry-capable `rc-egress` network.

### Security boundaries

The static gate requires:

- no `privileged: true`
- no host networking or host PID namespace
- no Docker socket mount
- no database port publication to the host
- `cap_drop: [ALL]` before any minimal capability addition on every service
- no added capabilities on the non-root Workstation
- only `CHOWN`, `DAC_OVERRIDE`, `FOWNER`, `SETGID`, and `SETUID` added back to MySQL, PostgreSQL, and Redis so their official entrypoints can initialize named volumes and drop to service users
- no dangerous additions such as `ALL`, `SYS_ADMIN`, `NET_ADMIN`, or `SYS_PTRACE`
- `no-new-privileges` on every service
- PID limits and health checks on every service
- a non-root Workstation user, defaulting to UID/GID 10001
- toolchain images matching `images.lock.json`
- no `curl | sh` or `curl | bash` in the Dockerfile

Local database passwords are only for the isolated Compose network and must never be copied into production.

### Commands

Static validation:

```bash
pnpm rc:workstation:validate
```

Print the Docker Compose execution plan:

```bash
pnpm rc:workstation:plan
```

Build the toolchain image:

```bash
pnpm rc:workstation:build
```

Start databases and Redis:

```bash
pnpm rc:workstation:up
```

Run core gates:

```bash
pnpm rc:workstation:core
```

Run the full profile including Playwright, Axe, and visual regression:

```bash
pnpm rc:workstation:full
```

Open an interactive shell:

```bash
pnpm rc:workstation:shell
```

Stop the environment:

```bash
pnpm rc:workstation:down
```

### File ownership

The image defaults to UID/GID 10001. Linux hosts may align the image user with the current host user before building:

```bash
export RC_WORKSTATION_UID="$(id -u)"
export RC_WORKSTATION_GID="$(id -g)"
pnpm rc:workstation:build
```

The `rc:first-run:*` orchestrator automatically reads the non-root host process UID/GID and passes them through Compose build arguments; explicit environment variables still take precedence. This keeps container-created `0600` JSON, Markdown, and logs readable by host-side triage and artifact upload steps. A root host process falls back to 10001 to avoid colliding with the container root account.

### Caches and data

Named volumes persist:

- pnpm Store
- Maven local repository
- Go cache
- uv cache
- MySQL data
- PostgreSQL data
- Redis AOF data

The source tree is bind-mounted at `/workspace`. `docker compose down` preserves named volumes; add `--volumes` only when the local test data is no longer needed.

### Acceptance criteria

- `pnpm rc:workstation:validate` passes
- Docker Compose configuration parses
- the Workstation health check confirms every toolchain
- MySQL, PostgreSQL, and Redis become healthy
- `rc:deps` completes frozen installation using the container pnpm Store
- `rc:gates:core` or `rc:gates:full` creates unified Gate and Triage reports
- no database port or Docker socket is exposed to the host
