import { expect, test } from '@playwright/test'
import { mockAuthenticatedApi, mockPublicApi, project } from './fixtures'

async function stabilize(page: import('@playwright/test').Page) {
  await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important} iframe{pointer-events:none!important}' })
  await page.waitForLoadState('networkidle')
  await page.evaluate(() => document.fonts.ready)
}

test('@visual home and command palette', async ({ page }) => {
  await mockPublicApi(page)
  await page.goto('/')
  await stabilize(page)
  await expect(page).toHaveScreenshot('home.png', { fullPage: true })
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+K' : 'Control+K')
  await expect(page).toHaveScreenshot('command-palette.png')
})

test('@visual template catalog and detail', async ({ page }) => {
  await mockPublicApi(page)
  await page.goto('/templates')
  await stabilize(page)
  await expect(page).toHaveScreenshot('templates.png', { fullPage: true })
  await page.goto('/templates/aurora-saas')
  await stabilize(page)
  await expect(page).toHaveScreenshot('template-detail.png', { fullPage: true })
})

test('@visual project workspace and editor', async ({ page, isMobile }) => {
  await mockAuthenticatedApi(page)
  await page.goto(`/projects/${project.id}`)
  await stabilize(page)
  await expect(page).toHaveScreenshot('project-workspace.png', { fullPage: true })
  if (!isMobile) {
    await page.getByRole('button', { name: '可视化编辑', exact: true }).click()
    await stabilize(page)
    await expect(page).toHaveScreenshot('visual-editor.png')
  }
})

test('@visual dark theme template detail', async ({ page }) => {
  await page.addInitScript(() => { localStorage.setItem('siteforge-theme', 'dark'); document.documentElement.dataset.theme = 'dark' })
  await mockPublicApi(page)
  await page.goto('/templates/aurora-saas')
  await stabilize(page)
  await expect(page).toHaveScreenshot('template-detail-dark.png', { fullPage: true })
})
