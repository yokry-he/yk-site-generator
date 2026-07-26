# 多实例登录限制 / Multi-instance Login Limits

[中文](#中文) · [English](#english)

## 中文

生成工程现在包含 `auth_login_limits` 共享状态表和五栈原生适配器。默认 `AUTH_LOGIN_LIMIT_DRIVER=database`，因此多个 API 实例使用同一数据库时共享失败次数和锁定时间。部署 Redis 时可以设置 `AUTH_REDIS_URL` 并使用带 TTL 的原子计数器；`memory` 只允许单实例开发。

共享键只保存邮箱或可信网络地址的 SHA-256/HMAC 摘要，不保存密码、Token 或请求体。数据库和 Redis 不可用时应采用 fail-closed 或显式受控降级，不能静默绕过登录限制。

## English

Generated projects now include an `auth_login_limits` shared-state table and stack-native adapters. `AUTH_LOGIN_LIMIT_DRIVER=database` is the default, so API replicas sharing one database also share failure counts and lockout timestamps. Redis deployments can use atomic counters with TTL; the memory driver is for single-process development only.

Keys contain only digests of normalized principals or trusted network addresses. Passwords, tokens, and request bodies are never stored. Store failures require an explicit fail-closed or controlled-degradation policy rather than silently bypassing protection.
