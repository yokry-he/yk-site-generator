# v0.1.0 RC Golden Projects / v0.1.0 RC 黄金样板工程

[中文](#中文) · [English](#english)

## 中文

### 目标

Golden Project 把生成器的抽象契约固定成五个可重复物化的真实工程。每个项目使用同一复杂业务模型，差异只来自技术栈与数据库。

### 固定项目

- Hono + Drizzle + SQLite
- NestJS + Prisma + PostgreSQL
- FastAPI + SQLAlchemy + PostgreSQL
- Spring Boot + JPA + PostgreSQL
- Gin + GORM + PostgreSQL

### 命令

```bash
pnpm rc:golden
pnpm rc:golden:update
```

命令连续生成两次并比较完整文件摘要，然后写入 `artifacts/golden-projects`。每个目录包含源码与 `golden.lock.json`，记录所有路径、字节数和 SHA-256。静态描述保存在 `fixtures/golden-projects/manifest.json`。

### 边界

物化阶段不安装或启动生成工程；真实 install、migrate、build、test、start 由数据库与运行矩阵执行。

## English

### Goal

Golden Projects turn abstract generator contracts into five repeatably materialized real projects. Every project uses the same complex business model; only the stack and database differ.

### Fixed projects

- Hono + Drizzle + SQLite
- NestJS + Prisma + PostgreSQL
- FastAPI + SQLAlchemy + PostgreSQL
- Spring Boot + JPA + PostgreSQL
- Gin + GORM + PostgreSQL

### Commands

```bash
pnpm rc:golden
pnpm rc:golden:update
```

The command generates every project twice, compares complete-file fingerprints, and writes the trees under `artifacts/golden-projects`. Each directory contains source files and a `golden.lock.json` with paths, byte sizes, and SHA-256 values. Stable descriptors live in `fixtures/golden-projects/manifest.json`.

### Boundary

Materialization does not install or start generated projects; the database and runtime matrix performs real install, migrate, build, test, and start flows.
