# Session 设备管理 / Session Device Management

[中文](#中文) · [English](#english)

## 中文

生成工程现在记录设备显示名、User-Agent 摘要和网络地址摘要，并提供活动 Session 列表、单设备撤销和“除当前设备外全部退出”。原始 User-Agent、IP 和 Token 不写入设备表；设备信息只能由当前用户读取和撤销。

接口包括 `GET /api/auth/sessions`、`DELETE /api/auth/sessions/{id}` 和 `POST /api/auth/sessions/revoke-others`。修改密码、禁用用户或角色降权时仍应撤销全部旧 Session。

## English

Generated projects now store a device label plus digests of the user agent and network address. They expose active-session listing, single-device revocation, and “revoke all except the current session.” Raw user agents, IP addresses, and tokens are not stored, and session devices remain scoped to the authenticated user.
