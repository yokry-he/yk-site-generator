# 模型厂商与真实生成 / Model Providers and Real Generation

[中文](#中文) · [English](#english)

---

## 中文

### 1. 为什么会看到“演示环境”

“演示环境”可能来自两类完全不同的场景：

1. **旧版模板库按钮**：早期 `main` 分支中的精选模板按钮只显示演示 Toast，并没有创建项目。这条提示与 API Key 是否有效无关。
2. **AI 生成器没有当前模型配置**：生成器找不到已启用的 Provider、API Key 和 Model 时，会使用本地演示动画与静态预览，不会产生模型费用。

当前开发分支已经提供真实模板流程、零配置内置项目和明确的模型模式状态。模板与内置项目不依赖模型；只有 AI 生成和 AI 迭代需要真实模型连接。

### 2. 切换到真实生成

运行最新开发分支并启动前后端：

```bash
git fetch origin
git switch agent/real-model-catalog-and-mode-status-20260725
pnpm install --frozen-lockfile
cp apps/server/.env.example apps/server/.env
pnpm dev
```

确认服务正常：

```bash
curl http://localhost:8787/api/health
```

然后在 Web 中：

1. 打开右上角“模型设置”。
2. 选择厂商。
3. 输入 API Key。
4. 保留官方 Base URL，或填写经过信任的兼容端点。
5. 点击“测试连接并同步模型”。
6. 从“当前账号可用 · 实时同步”选择模型，或直接输入模型 ID。
7. 点击“保存并启用真实生成”。
8. 打开 `/generator` 开始生成。

状态含义：

- **当前为演示模式**：没有已启用的模型配置。
- **真实生成已配置，尚未验证**：已经保存配置，但尚未成功测试当前 Key、Base URL 和 Model 的组合。
- **真实生成已验证**：测试连接成功，且保存的是同一组配置。

保存配置即可让生成器进入真实调用路径；成功测试不是强制条件，但强烈建议在首次生成前执行。

### 3. 模型目录如何更新

模型选择器由三层组成：

1. **当前账号可用**：点击测试连接后，服务端读取厂商 `/models` 返回值，并只保留文本／代码生成模型。这是当前 API Key 最可靠的可用性来源。
2. **推荐模型**：仓库维护的主力模型起点，便于首次配置。
3. **兼容旧配置**：保留旧别名，避免已有浏览器配置突然失效；它们不再作为默认推荐。

用户始终可以直接输入模型 ID。该能力适用于：

- 厂商刚发布、仓库尚未更新的模型；
- 只对特定账号开放的预览模型；
- 火山方舟 `ep-...` 推理接入点；
- 企业代理或兼容网关中的自定义模型名称。

实时目录响应限制为 512 KiB，最多保留 120 个模型 ID，避免异常厂商响应消耗过多内存。

### 4. 当前推荐模型

推荐目录最后审核日期：2026-07-25。厂商实时目录和官方文档优先级高于此静态表。

| 厂商 | 默认模型 | 推荐模型 |
| --- | --- | --- |
| OpenAI | `gpt-5.1` | `gpt-5.2`、`gpt-5.1`、`gpt-5`、`gpt-5-mini`、`gpt-5-nano`、`gpt-4.1` |
| Anthropic | `claude-sonnet-4-5` | `claude-sonnet-4-5`、`claude-opus-4-1`、`claude-haiku-4-5`、Claude 4 系列 |
| Google Gemini | `gemini-3.6-flash` | `gemini-3.6-flash`、`gemini-3.5-flash`、`gemini-3.5-flash-lite`、`gemini-3.1-pro-preview`、Gemini 2.5 系列 |
| DeepSeek | `deepseek-v4-pro` | `deepseek-v4-pro`、`deepseek-v4-flash` |
| Moonshot Kimi | `kimi-k2.5` | Kimi K2.5、K2 Preview／Thinking 系列；以账号实时目录为准 |
| 智谱 GLM | `glm-5.2` | `glm-5.2`、`glm-5.1`、`glm-5`、`glm-4.7` |
| 通义千问 | `qwen3.7-max` | `qwen3.7-max`、`qwen3.7-plus`、`qwen3.6-flash` |
| 字节豆包 | `doubao-seed-2-0-pro-260215` | Doubao Seed 2.0 Pro、Lite、Mini、Code；也可以填写 `ep-...` |

DeepSeek 的 `deepseek-chat` 与 `deepseek-reasoner` 已移入兼容旧配置分组，不再默认推荐。官方公告说明这两个别名在 2026-07-24 停止使用，应迁移到 `deepseek-v4-flash` 或 `deepseek-v4-pro`。

### 5. 兼容性说明

- OpenAI GPT-5 与 o 系列使用 `max_completion_tokens`，并避免发送可能被推理模型拒绝的 `temperature`。
- Gemini 3.6 Flash 与后续模型不发送已弃用的采样参数。
- 其他 OpenAI 兼容厂商继续使用广泛支持的 Chat Completions 请求格式。
- 厂商返回模型目录不代表每个模型都适用于 Chat Completions；最终以测试生成结果和厂商权限为准。
- 部分平台的 `/models` 不完整或不可用时，连接测试仍可成功，用户可以保存自定义模型 ID。

### 6. API Key 与网络安全

API Key 存储在浏览器 `localStorage`，仅在测试和生成请求中发送到 SiteForge Server。Server 不持久化、不记录 Key。

生产部署必须：

- 使用 HTTPS；
- 配置正确的 `VITE_API_BASE_URL` 和 `CORS_ORIGINS`；
- 保持 `ALLOW_PRIVATE_PROVIDER_BASE_URLS=false`；
- 不把真实 Key 写入 `.env.example`、日志、截图或 Git 提交。

本地 Ollama、LM Studio 或可信内网代理需要显式设置：

```env
ALLOW_PRIVATE_PROVIDER_BASE_URLS=true
```

该开关不能用于公共生产环境。

### 7. 常见问题

#### 测试连接成功，但仍显示未验证

测试之后还需要点击“保存并启用真实生成”。测试完成后修改 API Key、Base URL 或 Model 会使验证状态失效，需要重新测试。

#### 连接失败

检查：

- `http://localhost:8787/api/health`；
- API Key 是否属于所选厂商；
- Base URL 是否包含正确版本路径；
- 分域部署的 `VITE_API_BASE_URL` 和 `CORS_ORIGINS`；
- 账号余额、权限和地域；
- 本地模型是否启用了私网地址开关。

#### 模型不在下拉列表

先点击“测试连接并同步模型”。仍未出现时，直接在模型 ID 输入框填写厂商文档或控制台给出的 ID。

---

## English

### 1. Why the application may say “Demo environment”

“Demo environment” can refer to two separate situations:

1. **Legacy template-gallery action**: the early `main` branch used a hard-coded demo toast for its featured-template button and did not create a project. This message was unrelated to API-key validity.
2. **No active model connection in the AI generator**: when the generator cannot find an enabled Provider, API Key, and Model, it uses a local animation and static preview without making a billable model call.

The current development branch has real template creation, zero-configuration starter projects, and an explicit model-mode indicator. Templates and starter projects do not require a model. Only AI generation and AI iteration require a real provider connection.

### 2. Enable real generation

Run the latest development branch and start both applications:

```bash
git fetch origin
git switch agent/real-model-catalog-and-mode-status-20260725
pnpm install --frozen-lockfile
cp apps/server/.env.example apps/server/.env
pnpm dev
```

Verify the server:

```bash
curl http://localhost:8787/api/health
```

Then in the Web application:

1. Open **Model settings** in the top-right corner.
2. Select a provider.
3. Enter the API key.
4. Keep the official Base URL or enter a trusted compatible endpoint.
5. Select **Test connection and sync models**.
6. Choose a model under **Available to this account · live sync**, or enter a model ID directly.
7. Select **Save and enable real generation**.
8. Open `/generator` and generate a site.

Mode meanings:

- **Demo mode**: no enabled model configuration exists.
- **Real generation configured, not verified**: a configuration is saved but the current key, Base URL, and model combination has not passed a connection test.
- **Real generation verified**: the saved configuration matches a successful connection test.

Saving a configuration is sufficient to enter the real call path. Verification is not mandatory, but it is strongly recommended before the first generation.

### 3. How the model catalog stays current

The selector has three layers:

1. **Available to this account**: after a connection test, the server reads the provider `/models` response and keeps text/code generation models. This is the most reliable source for the current API key.
2. **Recommended models**: a curated starting list maintained in the repository.
3. **Legacy compatibility**: older aliases are preserved for existing browser configurations but are no longer recommended defaults.

A model ID can always be entered manually. This supports:

- newly released models not yet present in the repository;
- account-gated previews;
- Volcengine Ark `ep-...` inference endpoints;
- custom names exposed by enterprise proxies and compatible gateways.

Live catalog responses are capped at 512 KiB and 120 model IDs to prevent an abnormal upstream response from consuming unbounded memory.

### 4. Current recommendations

The curated catalog was last reviewed on 2026-07-25. Live provider results and official provider documentation take precedence over this table.

| Provider | Default | Recommended |
| --- | --- | --- |
| OpenAI | `gpt-5.1` | `gpt-5.2`, `gpt-5.1`, `gpt-5`, `gpt-5-mini`, `gpt-5-nano`, `gpt-4.1` |
| Anthropic | `claude-sonnet-4-5` | `claude-sonnet-4-5`, `claude-opus-4-1`, `claude-haiku-4-5`, and the Claude 4 family |
| Google Gemini | `gemini-3.6-flash` | `gemini-3.6-flash`, `gemini-3.5-flash`, `gemini-3.5-flash-lite`, `gemini-3.1-pro-preview`, and Gemini 2.5 models |
| DeepSeek | `deepseek-v4-pro` | `deepseek-v4-pro`, `deepseek-v4-flash` |
| Moonshot Kimi | `kimi-k2.5` | Kimi K2.5 and K2 preview/thinking models; use live account results as authority |
| Zhipu GLM | `glm-5.2` | `glm-5.2`, `glm-5.1`, `glm-5`, `glm-4.7` |
| Qwen | `qwen3.7-max` | `qwen3.7-max`, `qwen3.7-plus`, `qwen3.6-flash` |
| Doubao | `doubao-seed-2-0-pro-260215` | Doubao Seed 2.0 Pro, Lite, Mini, and Code; custom `ep-...` values are supported |

The DeepSeek aliases `deepseek-chat` and `deepseek-reasoner` have moved to the legacy group. DeepSeek announced that these aliases stop being supported on 2026-07-24; migrate to `deepseek-v4-flash` or `deepseek-v4-pro`.

### 5. Compatibility notes

- OpenAI GPT-5 and o-series models use `max_completion_tokens` and omit `temperature`, which some reasoning models reject.
- Gemini 3.6 Flash and future Gemini models are not sent deprecated sampling parameters.
- Other OpenAI-compatible providers retain the broadly supported Chat Completions request shape.
- A model appearing in `/models` does not guarantee Chat Completions support. Provider permissions and a real generation test remain authoritative.
- If a provider has no usable `/models` response, the connection test can still succeed and a custom model ID can still be saved.

### 6. API-key and network security

API keys are stored in browser `localStorage` and are sent to the SiteForge Server only during connection tests and generation requests. The server does not persist or log them.

Production deployments must:

- use HTTPS;
- configure `VITE_API_BASE_URL` and `CORS_ORIGINS` correctly;
- keep `ALLOW_PRIVATE_PROVIDER_BASE_URLS=false`;
- never put real keys in `.env.example`, logs, screenshots, or Git commits.

A trusted local Ollama, LM Studio, or private proxy requires:

```env
ALLOW_PRIVATE_PROVIDER_BASE_URLS=true
```

Never enable this switch in a public production environment.

### 7. Troubleshooting

#### The test succeeds but the status still says unverified

Select **Save and enable real generation** after testing. Changing the API key, Base URL, or model after a test invalidates the verification and requires another test.

#### The connection fails

Check:

- `http://localhost:8787/api/health`;
- whether the API key belongs to the selected provider;
- whether the Base URL contains the correct version path;
- `VITE_API_BASE_URL` and `CORS_ORIGINS` in split-domain deployments;
- account balance, permissions, and region;
- the private-address switch for local models.

#### A model is missing from the selector

Run **Test connection and sync models** first. If it still does not appear, enter the model ID shown in the provider documentation or console directly.
