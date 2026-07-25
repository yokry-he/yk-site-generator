import { expect, test } from '@playwright/test'
import { mockPublicApi } from './fixtures'

test('manual data model designer configures multiple CRUD resources', async ({ page, isMobile }) => {
  test.skip(isMobile, 'dense field editing is covered at desktop width; mobile layout remains in accessibility coverage')
  await mockPublicApi(page)
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await page.goto('/projects/new')

  await expect(page.getByRole('heading', { name: '4. 数据模型与 CRUD' })).toBeVisible()
  await expect(page.getByText(/数据模型有效：1 个实体/)).toBeVisible()
  await page.getByRole('button', { name: '新增实体' }).click()
  await expect(page.getByRole('tab', { name: /资源2/ })).toBeVisible()

  await page.getByLabel('代码名称（PascalCase）').fill('Article')
  await page.getByLabel('单数显示名').fill('文章')
  await page.getByLabel('模块显示名').fill('内容管理')
  await page.getByLabel('API 路由').fill('/articles')
  await page.getByRole('button', { name: '添加字段' }).click()

  const fieldNames = page.getByLabel('字段名（camelCase）')
  const fieldLabels = page.getByLabel('显示名')
  const fieldTypes = page.getByLabel('类型')
  await fieldNames.last().fill('status')
  await fieldLabels.last().fill('状态')
  await fieldTypes.last().selectOption('enum')
  await page.getByLabel('枚举值（逗号分隔）').fill('draft, published')

  await expect(page.getByText(/数据模型有效：2 个实体/)).toBeVisible()
  await expect(page.getByRole('button', { name: /生成并下载工程 ZIP/ })).toBeEnabled()
  await expect(page.getByText('CRUD 模块').locator('..').getByText('2')).toBeVisible()
  expect(pageErrors).toEqual([])
})

test('manual data model validation prevents invalid downloads', async ({ page }) => {
  await mockPublicApi(page)
  await page.goto('/projects/new')
  await page.getByLabel('API 路由').fill('/Invalid Route')
  await expect(page.getByRole('alert')).toContainText(/路由不合法/)
  await expect(page.getByRole('button', { name: /生成并下载工程 ZIP/ })).toBeDisabled()
})
