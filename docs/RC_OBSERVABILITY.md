# v0.1.0 RC Observability / v0.1.0 RC 可观测性

[中文](#中文) · [English](#english)

## 中文

服务端新增：

- `/api/health/live`：仅表示进程存活
- `/api/health/ready`：判断是否可以接收流量
- `/api/health/dependencies`：数据存储、Redis、Runner 与部署驱动摘要
- `/api/health/metrics`：受开关和 Token 保护的 Prometheus 文本指标

readiness 始终要求数据存储可用。Redis、Runner 和部署驱动只有在对应 `*_REQUIRED=true` 时才成为硬依赖。指标按规范化路由记录请求量、状态类别、活动请求和延迟直方图，不使用原始 UUID、预览 slug、邮箱或 Token 作为标签。

健康响应只输出驱动类型、策略和降级状态，不输出 URL、密码、密钥或 Webhook Secret。

## English

The server now exposes:

- `/api/health/live` for process liveness only
- `/api/health/ready` for traffic readiness
- `/api/health/dependencies` for data-store, Redis, Runner, and deployment summaries
- `/api/health/metrics` for switch- and token-protected Prometheus text metrics

Readiness always requires the data store. Redis, Runner, and deployment become hard dependencies only when their matching `*_REQUIRED=true` setting is enabled. Metrics normalize routes and record request totals, status classes, active requests, and latency histograms without using raw UUIDs, preview slugs, emails, or tokens as labels.

Health responses expose only driver types, policies, and degradation status; they never expose URLs, passwords, keys, or webhook secrets.
