# RC Runner Images / RC Runner 镜像

[中文](#中文) · [English](#english)

## 中文

五套 Runner 镜像固定 Node.js 24、Python 3.14、Java 21、Go 1.25 和对应包管理器。镜像内默认用户为 UID/GID 10001，不以 root 运行。生产环境必须通过 `RUNNER_IMAGE_LOCK_FILE` 提供 `@sha256:` 引用；缺少 Digest 时 Runner 拒绝启动。

容器运行时继续使用无网络、只读根文件系统、全部 capability 删除、`no-new-privileges`、PID/CPU/内存/文件描述符限制和独立 `/tmp`。每个容器带 `siteforge.runner=true` 标签，`scripts/cleanup-runner-containers.ts` 负责回收超过保留时间的异常容器。

镜像构建 Workflow 默认只生成本地归档摘要；显式选择 push 时才发布到 GHCR 并输出 Registry Digest。依赖离线缓存与镜像供应链签名仍需在部署环境配置。

## English

The five Runner images pin Node.js 24, Python 3.14, Java 21, Go 1.25, and their package managers. Images use UID/GID 10001 and never run as root by default. Production must provide `@sha256:` references through `RUNNER_IMAGE_LOCK_FILE`; the Runner rejects missing digests.

Containers retain no networking, a read-only root filesystem, all capabilities dropped, `no-new-privileges`, PID/CPU/memory/file-descriptor limits, and an isolated `/tmp`. Every container carries the `siteforge.runner=true` label, and `scripts/cleanup-runner-containers.ts` removes stale abnormal containers.

The image workflow produces archive checksums by default. It publishes to GHCR and records registry digests only when push is explicitly enabled. Offline dependency caches and supply-chain signing remain deployment responsibilities.
