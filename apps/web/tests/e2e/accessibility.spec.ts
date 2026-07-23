import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { mockPublicApi } from './fixtures'

async function expectNoSeriousViolations(page: import('@playwright/test').Page) {
  const result = await new AxeBuilder({ page }).exclude('iframe').analyze()
  const serious = result.violations.filter((item) => item.impact === 'serious' || item.impact === 'critical')
  expect(serious, serious.map((item) => `${item.id}: ${item.description}`).join('\n')).toEqual([])
}

test('public pages have no serious accessibility violations', async ({ page }) => {
  await mockPublicApi(page)
  for (const path of ['/', '/templates', '/templates/aurora-saas', '/generator']) {
    await page.goto(path)
    await expect(page.locator('#main-content')).toBeVisible()
    await expectNoSeriousViolations(page)
  }
})

test('skip link and shortcut dialog work from keyboard', async ({ page }) => {
  await mockPublicApi(page)
  await page.goto('/')
  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: '跳到主要内容' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.locator('#main-content')).toBeFocused()
  await page.keyboard.press('?')
  await expect(page.getByRole('dialog', { name: /快捷键中心/ })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: /快捷键中心/ })).toBeHidden()
})

test('drawer traps focus and restores it to trigger', async ({ page }) => {
  await mockPublicApi(page)
  await page.goto('/')
  const trigger = page.getByRole('button', { name: '打开通知中心' })
  await trigger.click()
  const drawer = page.getByRole('dialog', { name: '通知中心' })
  await expect(drawer).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(drawer).toBeHidden()
  await expect(trigger).toBeFocused()
})

test('mobile layouts avoid horizontal page overflow', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'mobile viewport assertion')
  await mockPublicApi(page)
  for (const path of ['/', '/templates', '/templates/aurora-saas', '/generator']) {
    await page.goto(path)
    const dimensions = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }))
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.width + 2)
  }
})
