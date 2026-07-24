# SiteForge 真实模型质量评测

## 目标

该流程为 Issue #28 建立可重复、可追踪的真实模型质量矩阵。普通 PR 的 `--dry-run` 仍只负责验证评分管线；真实质量结论必须来自带 `authoritative: true` 的报告。

## 固定评测协议

- 14 类站点，每类 3 个代表性需求，共 42 个用例
- 首轮基线每个用例重复 3 次，共 126 次模型调用
- 默认并发 3，单请求超时 180 秒
- Temperature 0.7，最大输出 8192 tokens
- 默认门槛：总体与单类型 80%，解析 98%，SEO head 与 HTML 健全度 95%
- 报告不保存模型密钥，也不保存模型完整原始响应
- Base URL 不写入报告，只记录显式标签或主机名

## 本地命令

先在环境中配置 `EVAL_BASE_URL`、`EVAL_API_KEY`、`EVAL_MODEL`，再执行：

```bash
EVAL_MODEL_LABEL=model-id-at-fixed-version \
EVAL_ENDPOINT_LABEL=provider \
EVAL_RUNS=3 \
EVAL_CONCURRENCY=3 \
pnpm --filter prompts eval:quality -- --runs 3 --report ../../artifacts/prompt-eval-real.json

pnpm --filter prompts eval:annotate -- \
  --input ../../artifacts/prompt-eval-real.json

pnpm --filter prompts eval:trend -- \
  --reports ../../artifacts/prompt-eval-real.json
```

`eval:annotate` 会补充提交 SHA、GitHub Workflow、执行参数和报告 ID，并移除完整 Base URL。`eval:trend` 可接收多个逗号分隔的报告，输出总体趋势、模型 × 站点类型矩阵和低于 80% 的 Beta 类型清单。

## GitHub Actions

`.github/workflows/prompt-quality-real.yml` 支持：

- `workflow_dispatch` 手动运行
- 每周一固定周期运行（合并到默认分支后生效）
- 缺少真实评测配置时生成明确状态文件，不伪造评测结果
- 上传真实报告、趋势 JSON、趋势 Markdown 和执行状态，保留 90 天
- 首轮基线使用 soft gate：即使模型分数低于门槛，仍保存完整证据供分析；后续稳定后再切换为强制阻断

2026-07-24 的首次受控探测 Run `30079013405` 已验证工具链、脱敏逻辑和 Artifact 上传正常；仓库当时未同时配置 `EVAL_API_KEY`、`EVAL_BASE_URL`、`EVAL_MODEL`，因此真实 126 次调用按设计跳过，未产生伪造质量结论。

## 报告比较

趋势报告按模型标签查找上一份结果，记录总体、解析、SEO 和 HTML 指标变化。要得到跨运行趋势，可将历史 Artifact 中的 JSON 下载到同一目录，并将多个路径传给 `--reports`。

首轮真实结果完成后应：

1. 将脱敏后的基线报告提交到 `quality/prompt-eval/`。
2. 对低于 80% 的站点类型创建 Prompt 优化 Issue，并在产品 UI 标记 Beta。
3. 固定模型版本、参数和提交 SHA，避免把供应商升级与代码变化混为同一个变量。
4. 至少再执行一次相同配置，验证趋势比较和稳定性。
