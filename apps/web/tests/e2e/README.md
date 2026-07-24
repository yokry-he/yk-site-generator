# SiteForge 浏览器质量测试 / Browser Quality Tests

[中文](#中文) · [English](#english)

---

## 中文

该目录使用 Playwright 在真实 Chromium 中验证产品行为、无障碍和视觉稳定性。它不替代 Vitest 单元测试，也不替代需要真实模型凭据的生成 E2E。

### 测试分层

- `core-flows.spec.ts`：命令面板、模板详情、项目编辑器、移动版本抽屉和版本对比。
- `accessibility.spec.ts`：公共路由挂载、未处理 `pageerror`、Skip Link、键盘顺序、焦点恢复、移动端横向溢出和 Axe serious/critical 规则。
- `visual.spec.ts`：桌面与手机、浅色与深色关键页面截图基线。
- `fixtures.ts`：稳定 API Mock，避免 UI 测试依赖邮箱、外部模型或生产基础设施。

浏览器无障碍验收至少包括：

- 图标按钮具备可访问名称。
- 表单控件具有标签。
- 正文与弱化文字保持 WCAG AA 对比度。
- 动画过程中不通过降低整体透明度制造瞬时低对比内容。
- 首页、内置项目、模板、生成器和项目工作区无横向溢出。
- 首次 Tab 可以到达 Skip Link。
- Dialog、Drawer 和 Sheet 关闭后焦点返回触发元素。
- 公共页面不得产生未处理的浏览器运行时错误。

### 本地命令

首次安装：

```bash
pnpm --filter web exec playwright install chromium
```

行为与无障碍测试：

```bash
pnpm --filter web e2e:browser
```

视觉回归：

```bash
pnpm --filter web e2e:visual
```

仅在有明确产品变化时更新基线：

```bash
pnpm --filter web e2e:visual:update
```

### 失败处理

- 行为与无障碍测试必须先通过，之后才允许更新视觉基线。
- 不得通过排除页面、降低 Axe 严重级别或无条件更新截图掩盖失败。
- 本地报告位于 `apps/web/playwright-report`，运行附件位于 `apps/web/test-results`。
- CI 报告作为 GitHub Actions Artifact 保留。
- 对比度失败应修复语义颜色或动画根因，而不是只为某一个测试环境增加例外。

---

## English

This directory uses Playwright with real Chromium to verify product behavior, accessibility, and visual stability. It does not replace Vitest unit tests or real-model generation E2E that requires provider credentials.

### Test layers

- `core-flows.spec.ts`: command palette, template detail, project editor, mobile version drawer, and version comparison.
- `accessibility.spec.ts`: public-route mounting, unhandled `pageerror`, skip link, keyboard order, focus restoration, mobile horizontal overflow, and Axe serious/critical rules.
- `visual.spec.ts`: desktop/mobile and light/dark screenshot baselines for key pages.
- `fixtures.ts`: deterministic API mocks so UI tests do not depend on email, external models, or production infrastructure.

Browser accessibility acceptance includes at least:

- Icon-only buttons have accessible names.
- Form controls have labels.
- Body and muted text meet WCAG AA contrast.
- Animations do not create temporary low-contrast content by fading the entire element.
- Home, starter-project, template, generator, and project-workspace pages do not overflow horizontally.
- The first Tab reaches the skip link.
- Dialogs, drawers, and sheets restore focus to their trigger when closed.
- Public pages produce no unhandled browser runtime errors.

### Local commands

Install once:

```bash
pnpm --filter web exec playwright install chromium
```

Behavior and accessibility:

```bash
pnpm --filter web e2e:browser
```

Visual regression:

```bash
pnpm --filter web e2e:visual
```

Update baselines only for an intentional product change:

```bash
pnpm --filter web e2e:visual:update
```

### Handling failures

- Behavior and accessibility must pass before visual baselines are updated.
- Do not hide failures by excluding pages, lowering Axe severity, or unconditionally regenerating screenshots.
- Local HTML reports are written to `apps/web/playwright-report`; run attachments are in `apps/web/test-results`.
- CI reports are retained as GitHub Actions artifacts.
- Contrast failures should be fixed at the semantic-color or animation root cause rather than with a test-only exception.
