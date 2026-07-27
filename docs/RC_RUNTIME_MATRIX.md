# v0.1.0 RC Runtime Matrix / v0.1.0 RC 真实运行矩阵

[中文](#中文) · [English](#english)

## 中文

`pnpm rc:matrix:plan` 输出五套 Golden Project 的真实执行计划；`pnpm rc:matrix` 执行 install、migrate、build、test、start、健康检查和认证冒烟。PostgreSQL 项目为每个工程创建独立数据库，SQLite 项目使用工程内文件数据库。

手动 Workflow `RC Golden Runtime Matrix` 为五个工程建立独立 Job，并安装 Node.js、Python/uv、Java/Maven、Go 和 PostgreSQL Client。普通 PR 不自动运行该高成本矩阵。

当前矩阵把任何安装、迁移、编译、测试、启动或认证失败都视为阻断项。真实 CRUD、字段权限、记录权限、Session 轮换和并发测试将在矩阵通过基础启动后继续扩充。

## English

`pnpm rc:matrix:plan` prints the real execution plan for all five Golden Projects. `pnpm rc:matrix` performs install, migrate, build, test, start, health, and authentication smoke checks. Every PostgreSQL project receives an isolated database, while SQLite uses the generated file database.

The manually dispatched `RC Golden Runtime Matrix` workflow creates one job per project and installs Node.js, Python/uv, Java/Maven, Go, and the PostgreSQL client. Normal pull requests do not automatically run this expensive matrix.

Any install, migration, compilation, test, startup, or authentication failure blocks the matrix. Real CRUD, field authorization, record authorization, session rotation, and concurrency coverage will be expanded after the base startup matrix is green.
