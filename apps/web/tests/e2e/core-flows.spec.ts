import { expect, test } from '@playwright/test'
import { mockAuthenticatedApi, mockPublicApi, project } from './fixtures'

test('command palette supports keyboard navigation', async ({ page }) => {
  await mockPublicApi(page)
  await page.goto('/')
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+K' : 'Control+K')
  const dialog = page.getByRole('dialog', { name: '全局命令面板' })
  await expect(dialog).toBeVisible()
  await dialog.getByPlaceholder('搜索命令、项目或工作区…').fill('模板')
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/templates$/)
})

test('model settings distinguish demo mode from verified real generation', async ({ page, isMobile }) => {
  test.skip(isMobile, 'desktop navigation exposes the model settings trigger')
  await mockPublicApi(page)
  await page.goto('/')

  await page.getByRole('button', { name: '模型设置' }).click()
  let dialog = page.getByRole('dialog')
  await expect(dialog.getByText('当前为演示模式')).toBeVisible()
  await page.keyboard.press('Escape')

  await page.evaluate(() => {
    localStorage.setItem('siteforge.models.v1', JSON.stringify({
      active: 'deepseek',
      connections: {
        deepseek: {
          apiKey: 'sk-browser-test-provider-key-1234567890',
          baseUrl: 'https://api.deepseek.com',
          model: 'deepseek-v4-pro',
          availableModels: ['deepseek-v4-pro', 'deepseek-v4-flash'],
          verifiedAt: '2026-07-25T00:00:00.000Z',
          latencyMs: 88,
        },
      },
    }))
  })
  await page.reload()
  await page.getByRole('button', { name: '模型设置' }).click()
  dialog = page.getByRole('dialog')
  await expect(dialog.getByText('真实生成已验证')).toBeVisible()
  await expect(dialog.getByPlaceholder(/模型 ID/)).toHaveValue('deepseek-v4-pro')
})

test('generator mounts when a real model is already persisted', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await mockPublicApi(page)
  await page.addInitScript(() => {
    localStorage.setItem('siteforge.models.v1', JSON.stringify({
      active: 'deepseek',
      connections: {
        deepseek: {
          apiKey: 'sk-browser-regression-test-key-123456',
          baseUrl: 'https://api.deepseek.com',
          model: 'deepseek-v4-pro',
          verifiedAt: '2026-07-25T00:00:00.000Z',
          latencyMs: 88,
        },
      },
    }))
  })

  await page.goto('/generator')
  await expect(page.getByRole('heading', { name: '亲眼看看,一句话如何变成网站' })).toBeVisible()
  await expect(page.getByText(/当前模型:DeepSeek · deepseek-v4-pro/)).toBeVisible()
  expect(pageErrors).toEqual([])
})

test('template detail customizes preview and links to AI', async ({ page }) => {
  await mockPublicApi(page)
  await page.goto('/templates/aurora-saas')
  await expect(page.getByRole('heading', { name: 'Aurora SaaS' })).toBeVisible()
  await page.getByRole('button', { name: '暖色' }).click()
  await page.getByLabel('核心标题').fill('浏览器测试中的新标题')
  await expect(page.locator('iframe[title="模板实时预览"]')).toBeVisible()
  await page.getByRole('button', { name: /切换到 AI 深度定制/ }).click()
  await expect(page).toHaveURL(/\/generator\?q=/)
})

test('project workspace opens editor and preserves draft operations', async ({ page, isMobile }) => {
  test.skip(isMobile, 'desktop editor behavior is covered separately from mobile drawer')
  await mockAuthenticatedApi(page)
  await page.goto(`/projects/${project.id}`)
  await expect(page.getByRole('heading', { name: project.title })).toBeVisible()
  await page.getByRole('button', { name: '编辑首页', exact: true }).click()
  const editor = page.getByRole('dialog').filter({ has: page.getByRole('button', { name: '关闭编辑器' }) })
  await expect(editor).toBeVisible()
  await expect(editor.getByRole('heading', { name: new RegExp(project.title) })).toBeVisible()
  await editor.getByRole('button', { name: '添加' }).click()
  await editor.getByRole('button', { name: /行动号召/ }).click()
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+Z' : 'Control+Z')
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+Shift+Z' : 'Control+Shift+Z')
  await expect(editor.getByText(/有未保存修改|草稿已自动保存/)).toBeVisible()
  await editor.getByRole('button', { name: /保存为新版本/ }).click()
  await expect(editor.getByText(/已保存/)).toBeVisible()
})

test('multi-page workspace adds and versions a page without replacing existing pages', async ({ page, isMobile }) => {
  test.skip(isMobile, 'dense page-management controls are covered at desktop width')
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await mockAuthenticatedApi(page)
  await page.goto(`/projects/${project.id}?tab=pages`)

  await expect(page.getByRole('heading', { name: '页面管理' })).toBeVisible()
  await expect(page.getByText('关于', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '新增' }).click()
  await page.getByLabel('页面名称').fill('联系我们')
  await page.getByLabel('访问路径').fill('/contact')
  await page.getByLabel('访问路径').blur()
  await expect(page.getByText('/contact', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: /保存整站版本/ }).click()
  await expect(page.getByText(/整站版本已保存/)).toBeVisible()
  expect(pageErrors).toEqual([])
})

test('mobile project exposes version history as bottom drawer', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'mobile-only version navigation')
  await mockAuthenticatedApi(page)
  await page.goto(`/projects/${project.id}`)
  await page.getByRole('button', { name: /版本/ }).first().click()
  const drawer = page.getByRole('dialog', { name: '版本历史' })
  await expect(drawer).toBeVisible()
  await drawer.getByRole('button', { name: /初始生成/ }).click()
  await expect(page).toHaveURL(/version=00000000-0000-4000-8000-000000000202/)
})

test('version comparison provides visual slider and structured changes', async ({ page, isMobile }) => {
  test.skip(isMobile, 'large visual comparison uses desktop viewport')
  await mockAuthenticatedApi(page)
  await page.goto(`/projects/${project.id}?tab=compare`)
  await page.getByLabel('选择对比版本').selectOption('00000000-0000-4000-8000-000000000202')
  await expect(page.getByText('结构化差异')).toBeVisible()
  await expect(page.getByLabel('拖动查看版本差异')).toBeVisible()
})
