import { describe, expect, it } from 'vitest'
import {
  OFFICIAL_TEMPLATES,
  getOfficialTemplate,
  officialTemplateDefaults,
  renderOfficialTemplate,
} from '../src/index'

describe('官方模板目录', () => {
  it('模板 ID 与 slug 唯一，覆盖主要站点类型', () => {
    expect(new Set(OFFICIAL_TEMPLATES.map((item) => item.id)).size).toBe(OFFICIAL_TEMPLATES.length)
    expect(new Set(OFFICIAL_TEMPLATES.map((item) => item.slug)).size).toBe(OFFICIAL_TEMPLATES.length)
    expect(OFFICIAL_TEMPLATES.length).toBeGreaterThanOrEqual(10)
    const types = new Set(OFFICIAL_TEMPLATES.map((item) => item.siteType))
    for (const type of ['saas', 'business', 'portfolio', 'landing', 'restaurant', 'shop', 'docs', 'dashboard']) {
      expect(types.has(type)).toBe(true)
    }
  })

  it('每个模板都可生成完整、响应式、自包含 HTML', () => {
    for (const template of OFFICIAL_TEMPLATES) {
      const html = renderOfficialTemplate(template)
      expect(html.toLowerCase()).toContain('<!doctype html>')
      expect(html).toContain('<meta name="viewport"')
      expect(html).toContain('<style>')
      expect(html).toContain('</html>')
      expect(html).not.toContain('<script')
      expect(html.length).toBeGreaterThan(8_000)
    }
  })

  it('变量会裁剪并转义，避免注入 HTML', () => {
    const template = OFFICIAL_TEMPLATES[0]
    const html = renderOfficialTemplate(template, {
      brandName: '<img src=x onerror=alert(1)>',
      headline: '<script>alert(1)</script>',
      description: '安全描述',
    })
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).not.toContain('<img src=x')
    expect(html).toContain('&lt;script&gt;')
    expect(html).toContain('安全描述')
  })

  it('支持按 ID 或 slug 查找并获取默认变量', () => {
    const first = OFFICIAL_TEMPLATES[0]
    expect(getOfficialTemplate(first.id)?.slug).toBe(first.slug)
    expect(getOfficialTemplate(first.slug)?.id).toBe(first.id)
    expect(officialTemplateDefaults(first).brandName).toBeTruthy()
  })
})
