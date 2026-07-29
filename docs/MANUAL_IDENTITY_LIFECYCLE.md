# 账号生命周期 / Identity Lifecycle

[中文](#中文) · [English](#english)

## 中文

生成工程提供修改密码、忘记密码、一次性重置 Token、邮箱验证和密码变更后撤销旧 Session。重置和验证 Token 使用 32 字节随机数，数据库只保存 SHA-256 摘要，并包含过期和单次消费状态。

`POST /api/auth/password/forgot` 与验证请求始终返回 202，避免泄露邮箱是否存在。邮件通过 `AUTH_MAIL_WEBHOOK_URL` 交给外部服务；日志不得记录原始 Token、密码或完整请求体。

## English

Generated projects provide password changes, enumeration-safe reset requests, one-time reset tokens, email verification, and old-session revocation after password changes. Tokens contain 32 random bytes, only SHA-256 digests are stored, and each record has expiry and single-consumption state.

Reset and verification request endpoints always return 202 so callers cannot determine whether an address exists. Delivery is delegated to `AUTH_MAIL_WEBHOOK_URL`; logs must not contain raw tokens, passwords, or request bodies.
