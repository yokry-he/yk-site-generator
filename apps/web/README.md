# SiteForge Web 前端 / Web Frontend

[中文](#中文) · [English](#english)

---

## 中文

`apps/web` 是 SiteForge 的 Vue 3 前端，使用 TypeScript、Vite、Vue Router 和 Tailwind CSS。

### 本地运行

在仓库根目录：

```bash
pnpm install --frozen-lockfile
pnpm --filter web dev
```

默认地址：`http://localhost:5173`。

开发服务器默认把 `/api/`、`/s/` 和 `/site/` 代理到 `http://localhost:8787`。自定义目标：

```bash
VITE_DEV_SERVER_TARGET=http://127.0.0.1:8787 pnpm --filter web dev
```

### 构建

```bash
pnpm --filter web build
```

产物位于 `apps/web/dist`。前后端分域时，在构建前设置：

```bash
VITE_API_BASE_URL=https://api.example.com pnpm --filter web build
```

### 测试

```bash
pnpm --filter web test
pnpm --filter web typecheck
pnpm --filter web check:bundle-budget
pnpm --filter web e2e:history
```

浏览器测试首次安装 Chromium：

```bash
pnpm --filter web exec playwright install chromium
pnpm --filter web e2e:browser
pnpm --filter web e2e:visual
```

详细说明：

- [`../../docs/DEVELOPMENT.md`](../../docs/DEVELOPMENT.md)
- [`../../docs/DEPLOYMENT.md`](../../docs/DEPLOYMENT.md)
- [`tests/e2e/README.md`](./tests/e2e/README.md)

---

## English

`apps/web` is the SiteForge Vue 3 frontend built with TypeScript, Vite, Vue Router, and Tailwind CSS.

### Local development

From the repository root:

```bash
pnpm install --frozen-lockfile
pnpm --filter web dev
```

Default URL: `http://localhost:5173`.

The development server proxies `/api/`, `/s/`, and `/site/` to `http://localhost:8787` by default. Override the target with:

```bash
VITE_DEV_SERVER_TARGET=http://127.0.0.1:8787 pnpm --filter web dev
```

### Build

```bash
pnpm --filter web build
```

Output is written to `apps/web/dist`. For separate frontend and API domains, set this before building:

```bash
VITE_API_BASE_URL=https://api.example.com pnpm --filter web build
```

### Tests

```bash
pnpm --filter web test
pnpm --filter web typecheck
pnpm --filter web check:bundle-budget
pnpm --filter web e2e:history
```

Install Chromium once for browser tests:

```bash
pnpm --filter web exec playwright install chromium
pnpm --filter web e2e:browser
pnpm --filter web e2e:visual
```

More details:

- [`../../docs/DEVELOPMENT.md`](../../docs/DEVELOPMENT.md)
- [`../../docs/DEPLOYMENT.md`](../../docs/DEPLOYMENT.md)
- [`tests/e2e/README.md`](./tests/e2e/README.md)
