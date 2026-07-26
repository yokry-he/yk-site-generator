# 隔离 Runner 与五栈验证 / Isolated Runner and Five-stack Verification

[中文](#中文) · [English](#english)

## 中文

Runner 默认 `RUNNER_DRIVER=disabled`。Docker 驱动使用预定义镜像和命令，不接受用户 Shell；容器使用 `--network=none`、只读根文件系统、独立临时工作目录、CPU／内存限制、输出上限和硬超时。工程文件来自已认证用户的云端工程版本，并在完成后删除临时目录。

支持 Hono、NestJS、FastAPI、Spring Boot 和 Gin 的 build、test、verify 动作。生产镜像必须预装并锁定依赖缓存；Runner 不能读取 SiteForge 主服务 Secret、Docker Socket 或宿主机任意路径。`local-process` 只用于受控开发环境。

## English

The runner defaults to `RUNNER_DRIVER=disabled`. The Docker driver accepts only predefined images and commands, never user shell input. Containers run with no network, a read-only root filesystem, isolated temporary workspaces, CPU/memory limits, bounded output, and a hard timeout. Files come from the authenticated user's cloud engineering project and temporary directories are removed afterward.

Build, test, and verify actions cover Hono, NestJS, FastAPI, Spring Boot, and Gin. Production images must contain pinned dependency caches. The runner must not receive SiteForge service secrets, the Docker socket, or arbitrary host paths. `local-process` is for controlled development only.
