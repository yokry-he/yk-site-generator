import { describe, expect, it } from 'vitest'
import {
  BRAND_PRESETS,
  applyBrandKitToHtml,
  bestContrastText,
  brandCssVariables,
  contrastRatio,
  normalizeHex,
} from '../src/index'

describe('brand theme utilities', () => {
  it('normalizes colors and calculates readable contrast', () => {
    expect(normalizeHex('#ABC')).toBe('#aabbcc')
    expect(normalizeHex('bad', '#123456')).toBe('#123456')
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1)
    expect(bestContrastText('#111827')).toBe('#ffffff')
    expect(bestContrastText('#f8fafc')).toBe('#000000')
  })

  it('builds stable CSS variables from a preset', () => {
    const variables = brandCssVariables(BRAND_PRESETS[0].tokens)
    expect(variables).toContain('--sf-brand-primary:#7c3aed')
    expect(variables).toContain('--sf-brand-radius:18px')
    expect(variables).not.toContain('{')
  })

  it('injects a single idempotent brand layer and updates theme color', () => {
    const preset = BRAND_PRESETS[1]
    const html = '<!doctype html><html><head><meta name="theme-color" content="#000000"></head><body><h1>Hello</h1></body></html>'
    const first = applyBrandKitToHtml(html, { id: preset.id, ...preset.tokens })
    const second = applyBrandKitToHtml(first, { id: preset.id, ...preset.tokens })
    expect((second.match(/id="siteforge-brand-kit"/g) ?? [])).toHaveLength(1)
    expect(second).toContain('content="#2563eb"')
    expect(second).toContain('--sf-brand-heading-font')
  })
})
