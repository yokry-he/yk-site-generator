# SiteForge 安全与滥用测试

## 自定义模型 Base URL

自定义 OpenAI 兼容端点在任何额度预占或上游请求之前执行两层校验：

1. URL 与字面地址校验
   - 仅允许 HTTP / HTTPS
   - 禁止 URL 用户名、密码、查询参数和片段
   - 生产环境必须使用 HTTPS
   - 阻断 localhost、本地域名后缀、云元数据域名、IPv4/IPv6 私网、环回、链路本地、文档、基准测试与其他保留地址
   - 覆盖整数、十六进制、缩写 IPv4、IPv4-mapped IPv6 和 6to4 嵌入地址等 URL 解析绕过形式
2. DNS 解析结果校验
   - 请求前解析全部 A / AAAA 记录
   - 任一记录落入非公网地址即拒绝整个端点
   - DNS 失败和空记录返回脱敏错误，不暴露解析器内部信息

模型生成流和模型测连接口均禁止自动跟随 HTTP 重定向，避免公开端点跳转到内网或云元数据地址。

本地模型开发确有需要时可设置：

```bash
ALLOW_PRIVATE_PROVIDER_BASE_URLS=true
```

公共生产环境不得启用该开关。

## 当前边界

本阶段显著收窄了 SSRF 攻击面，但 Node 全局 `fetch` 仍会独立执行实际连接时的 DNS 解析，因此“校验后到连接前瞬间切换 DNS”的 rebinding 竞态尚未通过 IP pinning 完全消除。后续完整防护应采用能够固定已验证地址的 HTTP dispatcher / lookup 回调，或将自定义厂商流量放入独立、无内网路由的出口代理。

## 回归测试

`apps/server/test/provider-url-policy.test.ts` 覆盖：

- 私网、环回、链路本地、文档及保留地址
- IPv4-mapped IPv6 与 6to4 私网嵌入
- URL 整数、十六进制及缩写地址
- 混合公网/私网 DNS 结果
- DNS 失败、空记录与错误脱敏
- 生成和测连接口在网络访问前拒绝危险地址

下一批安全测试继续跟踪于 Issue #29：模板 ZIP 路径穿越与 ZIP Bomb、危险 SVG/链接协议、发布与分享 IDOR、超大产物资源耗尽，以及连接层 DNS pinning。
