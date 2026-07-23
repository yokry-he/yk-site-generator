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
  await page.getByRole('button', { name: /可视化编辑/ }).click()
  await expect(page.getByRole('dialog')).toContainText('编辑版本')
  await page.getByRole('button', { name: '添加' }).click()
  await page.getByRole('button', { name: /行动号召/ }).click()
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+Z' : 'Control+Z')
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+Shift+Z' : 'Control+Shift+Z')
  await expect(page.getByText(/有未保存修改|草稿已自动保存/)).toBeVisible()
  await page.getByRole('button', { name: /保存为新版本/ }).click()
  await expect(page.getByText(/已保存/)).toBeVisible()
})

test('mobile project exposes version history as bottom drawer', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'mobile-only version navigation')
  await mockAuthenticatedApi(page)
  await page.goto(`/projects/${project.id}`)
  await page.getByRole('button', { name: /版本/ }).first().click()
  await expect(page.getByRole('dialog', { name: '版本历史' })).toBeVisible()
  await page.getByText('初始生成').click()
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
