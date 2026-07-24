# SiteForge Web 性能基线

## 目标

该基线把静态 Bundle 预算扩展为用户感知性能门槛，并为 Issue #30 提供可重复运行、包含原始样本和 P50/P95 的浏览器报告。

所有导航场景使用生产构建和 Chromium，不使用 Vite 开发服务器。

## 覆盖场景

### 核心路由

- 首页
- 模板目录
- 模板详情
- 已登录项目工作区

设备与网络矩阵：

- 桌面 `1440×1000`，本地网络，每路由 5 次独立浏览器上下文
- Pixel 7 `412×915`，本地网络，每路由 3 次
- Pixel 7，模拟 Slow 4G，首页 3 次

采集指标：

- 路由主要内容可见时间 `readyMs`
- TTFB
- DOMContentLoaded
- Load Event
- FCP
- LCP
- CLS
- 资源数量、传输字节和编码字节

### 用户交互

每项重复 5 次：

- 全局命令面板打开
- 模板变量修改到 iframe 实时预览更新
- 项目页打开可视化编辑器
- 编辑器保存不可变新版本

这些指标作为自动化环境中的 INP 等价业务延迟，用于发现具体工作流回退；它们不冒充真实用户 RUM INP。

### 大型 HTML

在 Chromium 中使用 DOMParser 分别解析：

- 500 KiB
- 2 MiB
- 5 MiB

每档重复 5 次并记录 P50/P95 和元素数量。

## 第一版门槛

| 指标 | 桌面本地 | 手机本地 | 手机 Slow 4G |
| --- | ---: | ---: | ---: |
| 主要内容 Ready P95 | 2500 ms | 3500 ms | 8000 ms |
| LCP P95 | 2000 ms | 3000 ms | 6000 ms |
| CLS P95 | 0.10 | 0.10 | 0.10 |

| 交互 | P95 上限 |
| --- | ---: |
| 命令面板打开 | 500 ms |
| 模板实时预览更新 | 800 ms |
| 编辑器打开 | 1500 ms |
| 保存新版本 | 1500 ms |

| HTML 大小 | 解析 P95 上限 |
| --- | ---: |
| 500 KiB | 200 ms |
| 2 MiB | 650 ms |
| 5 MiB | 1500 ms |

门槛首先用于阻止明显回退。第一次 Linux CI 实测后，应基于稳定分布收紧，而不是长期保留过宽上限。

## 命令

```bash
pnpm --filter web build
pnpm --filter web exec playwright install chromium
pnpm --filter web performance:baseline
```

默认输出：

- `artifacts/web-performance.json`
- `artifacts/web-performance.md`

设置 `PERF_ENFORCE=false` 可只生成报告而不因超限退出；正式 CI 使用强制模式。

## CI

`chromium-web-performance` Job 会：

1. 独立构建生产 Web
2. 安装 Chromium
3. 执行导航、交互和大型 HTML 性能矩阵
4. 将 Markdown 写入 Job Summary
5. 上传 JSON/Markdown Artifact，保留 30 天

## 已知边界与下一步

- 自动化交互延迟用于定位回退，不等同于真实用户 RUM INP
- 首次 Token、首次有效 AI 预览与完整生成耗时依赖真实模型配置，应与 #28 的固定模型矩阵结合
- 后续需要覆盖离线、重连、后台恢复和浏览器缓存冷热分层
- 报告历史趋势尚需在获得两次以上稳定基线后生成
- 应重点评估最大分块 `exportArtifact` 的延迟加载或拆分收益
