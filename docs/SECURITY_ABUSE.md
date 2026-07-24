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

## 品牌资源上传

品牌资源在写入或修改前执行内容级校验，而不是只信任浏览器提交的文件名和 MIME：

- Data URL 必须是标准 Base64，且解码后再次编码必须一致
- 以解码后字节数执行 2MB 上限
- PNG、JPEG、WebP 和 PDF 必须匹配文件签名
- Logo、图片、图标和背景只能使用允许的图片类型
- 文档资源只能使用合法 UTF-8 纯文本或 PDF
- 修改资源种类时，会使用存量内容与新种类的最终组合重新校验
- 校验失败发生在持久化之前，不会部分修改原资源

SVG 默认采用拒绝主动内容策略。以下内容不可进入资源库：

- `script`、`foreignObject`、`iframe`、`object`、`embed`
- `onload` 等事件属性
- 外部 `href` / `xlink:href`
- 外部 CSS、`@import` 和危险 `url()`
- `DOCTYPE`、`ENTITY`、`xml-stylesheet`
- `animate`、`set`、`discard` 等主动动画元素

该策略优先保证作为 Logo、图标和品牌图片使用时的静态安全性；需要复杂 SVG 动画的内容应在生成产物沙箱内单独处理，不能作为全局品牌资源上传。

## 当前边界

本阶段显著收窄了 SSRF 攻击面，但 Node 全局 `fetch` 仍会独立执行实际连接时的 DNS 解析，因此“校验后到连接前瞬间切换 DNS”的 rebinding 竞态尚未通过 IP pinning 完全消除。后续完整防护应采用能够固定已验证地址的 HTTP dispatcher / lookup 回调，或将自定义厂商流量放入独立、无内网路由的出口代理。

品牌资源策略会拒绝主动 SVG，但它不是通用 SVG 清洗器。未来如需支持更复杂的 SVG 子集，应采用经过审计的白名单解析与重新序列化，而不是扩大正则放行范围。

## 回归测试

`apps/server/test/provider-url-policy.test.ts` 与 `provider-redirect-policy.test.ts` 覆盖：

- 私网、环回、链路本地、文档及保留地址
- IPv4-mapped IPv6 与 6to4 私网嵌入
- URL 整数、十六进制及缩写地址
- 混合公网/私网 DNS 结果
- DNS 失败、空记录与错误脱敏
- 生成和测连接口在网络访问前拒绝危险地址
- 模型请求不能自动跟随重定向

`apps/server/test/brand-asset-policy.test.ts` 覆盖：

- 安全 PNG、SVG、文本和 PDF
- 伪造 MIME 与错误文件签名
- 畸形 Base64 和解码后超限
- 脚本、事件、外部引用、XML 实体和外部样式 SVG
- 创建前拒绝和修改种类绕过
- 校验失败后存量资源保持不变

下一批安全测试继续跟踪于 Issue #29：模板 ZIP 路径穿越与 ZIP Bomb、发布与分享 IDOR、超大产物资源耗尽，以及连接层 DNS pinning。
