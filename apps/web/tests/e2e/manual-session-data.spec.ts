import { expect, test } from '@playwright/test'
import { mockPublicApi } from './fixtures'

test('manual project wizard configures persistent session data', async ({ page, isMobile }) => {
  test.skip(isMobile, 'the dense permissions matrix is covered at desktop width')
  await mockPublicApi(page)
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await page.goto('/projects/new')

  await page.getByLabel('生成持久化用户与 Session 数据层').check()
  await page.getByLabel('Session 有效期（秒）').fill('43200')
  await page.getByLabel('单用户活动 Session 上限').fill('3')

  await expect(page.getByText(/持久化 Session 数据层/)).toBeVisible()
  await expect(page.getByRole('button', { name: /生成并下载工程 ZIP/ })).toBeEnabled()
  expect(pageErrors).toEqual([])
})

test('manual project wizard rejects unsafe session limits', async ({ page, isMobile }) => {
  test.skip(isMobile, 'the dense permissions matrix is covered at desktop width')
  await mockPublicApi(page)
  await page.goto('/projects/new')
  await page.getByLabel('生成持久化用户与 Session 数据层').check()
  await page.getByLabel('Session 有效期（秒）').fill('60')
  await expect(page.getByRole('alert')).toContainText(/Session 有效期/)
  await expect(page.getByRole('button', { name: /生成并下载工程 ZIP/ })).toBeDisabled()
})
