# v0.1.0 RC Security Audit / v0.1.0 RC 安全审计

[中文](#中文) · [English](#english)

## 中文

`pnpm rc:security` 对 Runner、在线预览、工程路径、发布门禁、Redis 限流和 Secret 示例执行阻断式静态审计，并输出 `artifacts/security-audit.json`。

可信门禁不再接受单独静态 Token。签名绑定 HTTP 方法、完整路径、时间戳、nonce 和原始请求体；时间偏差超限、签名不匹配或 nonce 重用都会降级为不可信证据。手工证据永远不能解锁 Production。

部署 Webhook 的接收方应验证相同的时间戳、nonce、HMAC 和 `Idempotency-Key`。本阶段提供发送和验证协议；跨 API 实例的全局 nonce 存储应在多实例部署时接入 Redis。

## English

`pnpm rc:security` performs blocking static checks over Runner isolation, preview headers, engineering paths, release evidence, Redis rate limits, and secret examples, writing `artifacts/security-audit.json`.

Trusted gates no longer accept a static token alone. Signatures bind the HTTP method, full path, timestamp, nonce, and raw request body. Excess clock skew, invalid signatures, or nonce reuse produces untrusted evidence. Manual evidence can never unlock Production.

Deployment webhook receivers should verify the same timestamp, nonce, HMAC, and `Idempotency-Key`. This stage defines sending and verification; multi-instance deployments should move the global nonce store to Redis.
