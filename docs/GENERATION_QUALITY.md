# 生成质量与速度策略 / Generation Quality and Speed

[中文](#中文) · [English](#english)

---

## 中文

### 1. 三档生成策略

生成策略同时影响 Prompt 约束、模型输出预算和界面反馈。

| 策略 | 适用场景 | 默认预算 | 页面目标 |
| --- | --- | ---: | --- |
| 极速草稿 | 快速验证方向，准备继续编辑 | 2800 tokens | 4–6 个关键区块，优先完整与快速 |
| 平衡生成 | 默认的大多数网站 | 4600 tokens | 6–8 个完整区块，平衡内容、视觉和速度 |
| 精致成品 | 需要高完成度的对外页面 | 7200 tokens | 7–10 个高完成度区块，并执行无障碍与性能自检 |

所有模式都遵循同一条底线：完整、可运行产物优先于装饰数量。模型预算是上限，不是必须消耗完的目标。

### 2. 精致模式质量约束

精致成品模式会要求模型在输出前静默检查：

- HTML、代码围栏和标签完整闭合
- 页面有明确视觉概念，而不是通用模板拼接
- 文案、示例数据、标签和 CTA 具体可信
- 桌面、平板和手机布局完整
- 移动端横向溢出、长文本、卡片密度和触控尺寸
- 键盘焦点、颜色对比、替代文本和按钮可读名称
- `prefers-reduced-motion` 支持
- 重复 ID、失效链接、空白按钮和占位文案
- 首屏阻塞、重量级依赖、图片尺寸、懒加载和布局偏移

这些指令提高模型输出的约束程度，但不能替代真实浏览器、Axe、质量检查中心和人工验收。

### 3. 流式生成性能

前端不会对每个 Provider fragment 立即执行响应式渲染。短时间内的分片会进入缓冲区，再批量更新：

- 文本和 iframe 预览约每 120ms 最多提交一次
- 完成、错误或主动停止时立即 flush
- 最后一批内容不会因定时器未触发而丢失
- 减少 Vue 更新、HTML 提取和 iframe `srcdoc` 重载
- 生成器通过组件事件直接同步产物工具栏，不再周期性扫描 DOM

该优化降低浏览器主线程成本。模型首 token 和持续吞吐仍取决于 Provider、模型、网络和输出长度。

### 4. 观测指标

生成完成事件和界面应记录或展示：

- `mode`：生成策略
- `maxTokens`：模型预算
- `firstTokenMs`：首 token 延迟
- `durationMs`：总耗时
- `outputChars`：输出字符数
- 模型与站点类型
- 产物解析是否成功
- 错误分类与停止状态

不得记录用户 API Key。原始需求全文也不应进入普通诊断事件。

### 5. 验证方法

#### Prompt 管线自检

```bash
pnpm --filter prompts eval:quality -- --dry-run
```

只验证评测代码，不代表真实模型质量。

#### 真实模型对比

```bash
EVAL_BASE_URL=https://provider.example.com/v1 \
EVAL_API_KEY=replace-me \
EVAL_MODEL=model-name \
pnpm --filter prompts eval:quality -- --runs 3
```

建议在同一个模型版本、温度、站点类型和测试用例下比较平衡与精致模式，并至少观察：

- 解析成功率
- 总体与单类型质量分
- 首 token P50/P95
- 总生成耗时 P50/P95
- 输出长度与成本
- 移动端溢出和 Axe 问题
- 人工可直接交付率

### 6. 调优原则

- 不通过无限提高 Token 上限掩盖 Prompt 结构问题。
- 不为了更快而允许截断、缺少闭合标签或不可运行产物。
- 不为了视觉丰富引入重量级前端框架或大量首屏脚本。
- 优先让首屏结构尽早出现，但不要对每个 token 重载 iframe。
- 真实模型结论必须绑定模型、参数、提交 SHA 和报告。
- 低分类型应定向修改 Prompt，并使用相同参数复测。

---

## English

### 1. Three generation modes

A generation mode changes prompt constraints, model output budget, and UI feedback together.

| Mode | Use case | Default budget | Page target |
| --- | --- | ---: | --- |
| Fast draft | Validate direction quickly and continue editing | 2800 tokens | 4–6 essential sections, optimized for completeness and speed |
| Balanced | Default for most websites | 4600 tokens | 6–8 complete sections balancing content, visual quality, and speed |
| Quality | High-fidelity public-facing pages | 7200 tokens | 7–10 polished sections with accessibility and performance self-checks |

Every mode follows the same floor: a complete, runnable artifact is more important than decorative volume. The token budget is a ceiling, not a target that must be exhausted.

### 2. Quality-mode constraints

Quality mode asks the model to silently check before returning output:

- Complete HTML, code-fence, and tag closure
- A clear visual concept instead of generic template assembly
- Specific and credible copy, sample data, labels, and CTAs
- Complete desktop, tablet, and mobile layouts
- Mobile overflow, long text, card density, and touch targets
- Keyboard focus, color contrast, alternative text, and accessible button names
- `prefers-reduced-motion` support
- Duplicate IDs, broken links, empty buttons, and placeholder copy
- Render-blocking work, heavyweight dependencies, image dimensions, lazy loading, and layout shift

These instructions improve model constraints, but they do not replace real-browser testing, Axe, the quality-check workspace, or human acceptance.

### 3. Streaming performance

The frontend does not trigger reactive rendering for every provider fragment. Short bursts are buffered and committed in batches:

- Text and iframe preview updates are capped at roughly one commit every 120ms
- Completion, error, and cancellation flush immediately
- The final batch is not lost while waiting for a timer
- Vue updates, HTML extraction, and iframe `srcdoc` reloads are reduced
- The generator synchronizes with the artifact toolbar through component events instead of periodic DOM scans

This reduces browser-main-thread cost. Model first-token latency and sustained throughput still depend on the provider, model, network, and output length.

### 4. Observability

Completion events and the UI should record or display:

- `mode`: generation mode
- `maxTokens`: model budget
- `firstTokenMs`: first-token latency
- `durationMs`: total duration
- `outputChars`: output characters
- Model and site type
- Artifact parse success
- Error category and cancellation state

User API keys must never be recorded. Full raw prompts should not be included in normal diagnostic events.

### 5. Validation

#### Prompt-pipeline dry run

```bash
pnpm --filter prompts eval:quality -- --dry-run
```

This validates evaluation code only; it is not evidence of real model quality.

#### Real-model comparison

```bash
EVAL_BASE_URL=https://provider.example.com/v1 \
EVAL_API_KEY=replace-me \
EVAL_MODEL=model-name \
pnpm --filter prompts eval:quality -- --runs 3
```

Compare balanced and quality modes with the same model version, temperature, site types, and cases. Observe at least:

- Parse success rate
- Overall and per-site-type quality scores
- First-token P50/P95
- Total generation P50/P95
- Output length and cost
- Mobile overflow and Axe violations
- Human-assessed ready-to-ship rate

### 6. Tuning principles

- Do not hide prompt-structure problems by increasing token limits indefinitely.
- Do not trade speed for truncated, unclosed, or non-runnable artifacts.
- Do not add heavyweight frontend frameworks or excessive first-screen scripts merely for visual richness.
- Make useful first-screen structure appear early without reloading the iframe for every token.
- Real-model conclusions must be tied to model, parameters, commit SHA, and report.
- Fix low-scoring site types with targeted prompt changes and rerun with identical parameters.
