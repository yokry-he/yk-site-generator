# SiteForge 安全与滥用测试 / Security and Abuse Testing

[中文](#中文) · [English](#english)

---

## 中文

### 1. 自定义模型 Base URL

自定义 OpenAI 兼容端点在任何额度预占或上游请求之前执行两层校验。

#### URL 与字面地址

- 只允许 HTTP 和 HTTPS。
- 禁止 URL 用户名、密码、查询参数和片段。
- 生产环境中的自定义地址必须使用 HTTPS。
- 阻断 localhost、本地域名后缀和云元数据域名。
- 阻断 IPv4/IPv6 私网、环回、链路本地、文档、基准测试、共享和其他保留地址。
- 覆盖整数、十六进制、缩写 IPv4、IPv4-mapped IPv6 和 6to4 嵌入地址等解析绕过形式。

#### DNS 解析结果

- 请求前解析全部 A 和 AAAA 记录。
- 只要任一记录不是公网地址，就拒绝整个端点。
- DNS 失败和空记录返回脱敏错误，不暴露解析器内部信息。

模型生成流和 Provider 测连接口都禁止自动跟随 HTTP 重定向，避免公开地址跳转到内网或元数据服务。

可信本地模型开发可以显式设置：

```env
ALLOW_PRIVATE_PROVIDER_BASE_URLS=true
```

公共生产环境必须保持 `false`。

### 2. 品牌图片与资源上传

品牌资源库以及品牌套件内嵌的 Logo、深色 Logo、竖版 Logo、Logo Mark、Favicon 和 OG 图片，在写入或修改前执行内容级校验，而不是信任浏览器提交的文件名或 MIME。

- Data URL 必须使用标准 Base64，解码后重新编码必须一致。
- 以解码后字节数执行大小上限；品牌套件字段另有更小的输入长度限制。
- PNG、JPEG、WebP 和 PDF 必须匹配文件签名。
- Logo、图片、图标和背景只能使用允许的图片类型。
- 文档资源只能使用合法 UTF-8 纯文本或 PDF。
- 修改资源类型时，使用存量内容与新类型的最终组合重新校验。
- 校验失败发生在持久化之前，不会留下部分修改。

SVG 默认采用静态内容策略，拒绝：

- `script`、`foreignObject`、`iframe`、`object`、`embed`
- `onload` 等事件属性
- 外部 `href` 和 `xlink:href`
- 外部 CSS、`@import` 和危险 `url()`
- `DOCTYPE`、`ENTITY` 和 `xml-stylesheet`
- `animate`、`set`、`discard` 等主动动画元素

该策略适合 Logo、图标和静态品牌图片，不是通用 SVG 清洗器。未来如需支持复杂 SVG 子集，应使用经过审计的白名单解析和重新序列化。

### 3. 跨账号资源隔离

所有登录后私有资源同时使用资源 ID 与当前令牌用户 ID 查询。访问其他账号资源时统一返回 404，而不是使用 403 或不同错误，减少资源枚举信号。

当前自动化矩阵覆盖：

- 项目读取、修改、删除和复制
- 项目版本读取、修改、新建和回滚
- 使用他人项目或版本创建发布
- 发布修改、重新发布和删除
- 品牌套件读取、修改、设为默认和删除
- 品牌资源修改和删除
- 项目、品牌资源与其他账号品牌套件的跨账号关联
- 列表隔离以及攻击后所有者资源未被部分修改的验证

公开分享链接不是账号私有资源。删除权限由独立高熵删除令牌控制，需要单独验证令牌比较、过期和并发删除行为。

### 4. 当前边界

#### DNS Rebinding

Node 全局 `fetch` 会在实际连接时重新解析 DNS，因此“校验后、连接前”切换地址的 rebinding 竞态尚未通过 IP pinning 完全消除。完整防护应使用固定已验证地址的 HTTP dispatcher/lookup，或把自定义 Provider 流量放入没有内网路由的独立出口代理。

#### 请求体与资源耗尽

字段 Schema 已限制多类内容大小，但后续仍需在 JSON 解析前实施字节级请求体限制，并验证超大生成结果、慢速 SSE、并发生成和长期历史的资源释放。

#### ZIP 导入

当前仓库只有 ZIP 导出，没有模板 ZIP 导入或解压入口，因此不存在现有 ZIP 路径穿越或 ZIP Bomb 攻击面。未来增加导入功能时，必须在同一个 PR 中实现路径规范化、文件数量、单文件大小、解压总量、压缩比和符号链接限制。

### 5. 回归测试

`provider-url-policy.test.ts` 与 `provider-redirect-policy.test.ts` 覆盖：

- 私网、环回、链路本地、文档和保留地址
- IPv4-mapped IPv6 与 6to4 私网嵌入
- URL 整数、十六进制和缩写地址
- 混合公网／私网 DNS 结果
- DNS 失败、空记录和错误脱敏
- 生成与测连接口在网络请求前拒绝危险地址
- 模型请求不自动跟随重定向

`brand-asset-policy.test.ts` 与 `brand-kit-image-security.test.ts` 覆盖：

- 安全 PNG、SVG、文本和 PDF
- 伪造 MIME 和错误文件签名
- 畸形 Base64 和解码后超限
- 脚本、事件、外部引用、XML 实体和外部样式 SVG
- 品牌资源创建前拒绝和资源类型绕过
- 品牌套件内嵌图片创建与 PATCH 拒绝
- 校验失败后存量资源保持不变

`resource-ownership-matrix.test.ts` 覆盖项目、版本、发布、品牌套件、品牌资源和跨资源关联的账号隔离。

### 6. 安全问题处理原则

- 不提交真实 API Key、JWT Secret、数据库密码或邮件 Token。
- 安全错误对客户端使用稳定、脱敏的错误码。
- 拒绝请求必须发生在额度预占、持久化或上游网络访问之前。
- PATCH 校验失败必须保持原记录不变。
- 不为不存在的功能增加孤立“安全工具”；安全边界应与真实入口同时交付。
- 新增公开入口、文件类型、Provider 协议或跨资源关联时，必须同步扩展对抗测试。

下一批安全工作跟踪于 Issue #29：分享删除令牌、请求体与资源耗尽、连接层 DNS pinning，以及未来 ZIP 导入安全。

---

## English

### 1. Custom model Base URLs

Custom OpenAI-compatible endpoints are validated in two stages before quota reservation or any upstream request.

#### URL and literal-address checks

- Only HTTP and HTTPS are allowed.
- URL usernames, passwords, query strings, and fragments are rejected.
- Custom production endpoints must use HTTPS.
- Localhost, local-domain suffixes, and cloud metadata hostnames are blocked.
- Private, loopback, link-local, documentation, benchmark, shared, and other reserved IPv4/IPv6 ranges are blocked.
- Integer, hexadecimal, shortened IPv4, IPv4-mapped IPv6, and 6to4 embedded-address bypass forms are covered.

#### DNS-result checks

- Resolve every A and AAAA record before the request.
- Reject the entire endpoint if any record is not publicly routable.
- DNS failures and empty results return sanitized errors without resolver internals.

Generation streams and provider connection tests disable automatic HTTP redirects so a public URL cannot redirect into a private network or metadata service.

Trusted local-model development may explicitly set:

```env
ALLOW_PRIVATE_PROVIDER_BASE_URLS=true
```

Public production environments must keep it `false`.

### 2. Brand images and asset uploads

The brand asset library and embedded brand-kit images—logos, dark logos, vertical logos, logo marks, favicons, and Open Graph images—use content-level validation before create or update. Browser filenames and MIME declarations are not trusted.

- Data URLs must use canonical standard Base64; decoding and re-encoding must match.
- Limits are enforced on decoded bytes; brand-kit fields retain smaller input-length limits.
- PNG, JPEG, WebP, and PDF must match their signatures.
- Logos, images, icons, and backgrounds may use only approved image types.
- Document assets may use valid UTF-8 plain text or PDF only.
- Changing an asset kind revalidates the final combination of existing content and the new kind.
- Validation happens before persistence, so failure cannot leave a partial update.

SVG uses a static-content policy and rejects:

- `script`, `foreignObject`, `iframe`, `object`, and `embed`
- Event attributes such as `onload`
- External `href` and `xlink:href`
- External CSS, `@import`, and dangerous `url()` values
- `DOCTYPE`, `ENTITY`, and `xml-stylesheet`
- Active animation elements such as `animate`, `set`, and `discard`

This policy is appropriate for logos, icons, and static brand images; it is not a general-purpose SVG sanitizer. A future complex SVG subset should use an audited allowlist parser and reserialization.

### 3. Cross-account resource isolation

Every authenticated private-resource query combines the resource ID with the current token's user ID. Another tenant's resources return a uniform 404 instead of a 403 or resource-specific error, reducing enumeration signals.

The current automated matrix covers:

- Project read, update, delete, and copy
- Project-version read, update, create, and rollback
- Publishing from another user's project or version
- Publication update, republish, and delete
- Brand-kit read, update, set-default, and delete
- Brand-asset update and delete
- Cross-account links between projects/assets and another tenant's brand kit
- List isolation and post-attack verification that owner data was not partially changed

Public share links are not account-private resources. Deletion is controlled by a separate high-entropy token and requires independent comparison, expiry, and concurrency tests.

### 4. Current boundaries

#### DNS rebinding

Node global `fetch` resolves DNS again for the actual connection. A host that changes between validation and connection is therefore not completely eliminated without IP pinning. Complete protection should use an HTTP dispatcher/lookup that binds the verified address or route provider traffic through isolated egress with no private-network routes.

#### Request bodies and resource exhaustion

Field schemas already limit many values, but byte-level request limits are still needed before JSON parsing, along with tests for oversized generation output, slow SSE, concurrent generation, and long-history cleanup.

#### ZIP imports

The repository currently exports ZIP files but has no template ZIP import or extraction endpoint, so there is no existing ZIP traversal or ZIP-bomb surface. Any future import feature must implement path normalization, file-count, per-file size, expanded-total size, compression-ratio, and symlink limits in the same PR.

### 5. Regression tests

`provider-url-policy.test.ts` and `provider-redirect-policy.test.ts` cover:

- Private, loopback, link-local, documentation, and reserved ranges
- IPv4-mapped IPv6 and private 6to4 embedding
- Integer, hexadecimal, and shortened URL addresses
- Mixed public/private DNS results
- DNS failure, empty results, and error sanitization
- Rejection before network access in generation and connection-test endpoints
- Redirects disabled for provider requests

`brand-asset-policy.test.ts` and `brand-kit-image-security.test.ts` cover:

- Safe PNG, SVG, text, and PDF
- Forged MIME and invalid signatures
- Malformed Base64 and decoded-size overflow
- Script, event, external-reference, XML-entity, and external-style SVG variants
- Pre-create rejection and asset-kind bypass attempts
- Embedded brand-kit image rejection during create and PATCH
- Existing data unchanged after validation failure

`resource-ownership-matrix.test.ts` covers tenant isolation for projects, versions, publications, brand kits, brand assets, and cross-resource links.

### 6. Security-handling principles

- Never commit real API keys, JWT secrets, database passwords, or email tokens.
- Client-facing security errors use stable, sanitized codes.
- Rejection must happen before quota reservation, persistence, or upstream network access.
- A failed PATCH must leave the existing record unchanged.
- Do not add isolated “security utilities” for nonexistent features; security boundaries ship with real entry points.
- Every new public endpoint, file type, provider protocol, or cross-resource relationship must extend adversarial tests in the same change.

The next security work is tracked in Issue #29: share deletion tokens, request/body resource exhaustion, connection-level DNS pinning, and future ZIP-import security.
