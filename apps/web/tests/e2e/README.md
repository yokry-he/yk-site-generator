# SiteForge 浏览器质量测试

该目录由 Playwright 在真实 Chromium 中验证产品行为，不替代 Vitest 单元测试或真实模型生成 E2E。

## 测试分层

- `core-flows.spec.ts`：命令面板、模板详情、项目编辑器、移动版本抽屉和版本对比。
- `accessibility.spec.ts`：Skip Link、键盘顺序、移动端横向溢出和 Axe 严重级无障碍规则。
- `visual.spec.ts`：桌面与手机、浅色与深色关键页面截图基线。
- `fixtures.ts`：稳定 API Mock，避免浏览器 UI 测试依赖邮箱、外部模型或生产基础设施。

浏览器无障碍验收至少包括：图标按钮具备可访问名称，表单控件具有标签，弱化文字保持 WCAG AA 对比度，首页与关键工作区无横向溢出，首次 Tab 可以到达 Skip Link，弹层关闭后焦点可返回触发元素。

## 本地命令

```bash
pnpm --filter web exec playwright install chromium
pnpm --filter web e2e:browser
pnpm --filter web e2e:visual
pnpm --filter web e2e:visual:update
```

行为测试必须先通过，之后才允许更新视觉基线。截图变化应由产品改动解释，不能仅通过无条件更新基线消除失败。
