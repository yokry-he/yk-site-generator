# RC Redis Multi-instance / RC Redis 多实例

[中文](#中文) · [English](#english)

## 中文

平台验证码申请和校验现在支持 Redis 原子限流。申请入口使用原子计数窗口；校验入口使用共享失败计数和锁定 Key。邮箱只以 HMAC-SHA256 摘要进入 Redis，不保存原始地址。

生产环境默认 `AUTH_RATE_LIMIT_FAIL_MODE=closed`：Redis 不可用时返回 503，不静默降级为单进程内存。内存模式只用于开发与测试。`RC Redis Multi-instance` Workflow 启动两个 API 进程，共享同一个 Redis，并交替发送失败校验请求；只有跨进程共享锁定成功才通过。

当前实现支持单节点 Redis/Redis TLS URL。Redis Cluster、Sentinel 和数据库二级降级属于部署扩展，不在本阶段内假装已验证。

## English

Verification-code request and confirmation endpoints now support atomic Redis rate limits. Requests use an atomic counter window, while verification uses shared failure and lock keys. Only HMAC-SHA256 email digests enter Redis; raw addresses are not stored.

Production defaults to `AUTH_RATE_LIMIT_FAIL_MODE=closed`: Redis failure returns 503 instead of silently falling back to per-process memory. Memory mode is limited to development and tests. The `RC Redis Multi-instance` workflow starts two API processes sharing one Redis instance and alternates failed verification requests; it passes only when the lockout is shared across processes.

The implementation supports single-node Redis and TLS Redis URLs. Redis Cluster, Sentinel, and database secondary fallback are deployment extensions and are not claimed as verified here.
