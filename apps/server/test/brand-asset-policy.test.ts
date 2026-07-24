import { beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../src/app'
import { validateBrandAssetDataUrl } from '../src/lib/brand-asset-policy'
import { resetDataStoreForTest } from '../src/lib/data-store'

const app = createApp()

function dataUrl(mime: string, content: string | Uint8Array): string {
  return `data:${mime};base64,${Buffer.from(content).toString('base64')}`
}

function validPng(): string {
  return dataUrl('image/png', Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]))
}

async function login(email: string): Promise<string> {
  const requested = await app.request('/api/auth/request-code', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email }),
  })
  const code = (await requested.json()).debugCode
  const verified = await app.request('/api/auth/verify', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, code }),
  })
  return (await verified.json()).accessToken
}

function headers(token: string) {
  return { authorization: `Bearer ${token}`, 'content-type': 'application/json' }
}

beforeEach(() => resetDataStoreForTest())

describe('品牌资源内容策略', () => {
  it('接受签名匹配的图片、纯文本、PDF 和静态 SVG', () => {
    expect(validateBrandAssetDataUrl(validPng(), 'image').mime).toBe('image/png')
    expect(
      validateBrandAssetDataUrl(
        dataUrl('image/svg+xml', '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0h10v10z"/></svg>'),
        'logo',
      ).mime,
    ).toBe('image/svg+xml')
    expect(validateBrandAssetDataUrl(dataUrl('text/plain', '品牌使用说明'), 'document').mime).toBe(
      'text/plain',
    )
    expect(validateBrandAssetDataUrl(dataUrl('application/pdf', '%PDF-1.7\n%%EOF'), 'document').mime).toBe(
      'application/pdf',
    )
  })

  it.each([
    '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject><iframe src="https://evil.example"></iframe></foreignObject></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg"><image href="https://tracker.example/pixel"/></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg"><style>@import url(https://evil.example/x.css)</style></svg>',
    '<!DOCTYPE svg [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><svg xmlns="http://www.w3.org/2000/svg">&xxe;</svg>',
  ])('拒绝主动 SVG 内容 %#', (svg) => {
    expect(() => validateBrandAssetDataUrl(dataUrl('image/svg+xml', svg), 'image')).toThrow()
  })

  it('拒绝伪造 MIME、类型不匹配、畸形 Base64 和解码后超限', () => {
    expect(() => validateBrandAssetDataUrl(dataUrl('image/png', 'not-png'), 'image')).toThrow(
      'PNG 文件签名无效',
    )
    expect(() => validateBrandAssetDataUrl(validPng(), 'document')).toThrow('文档资源仅支持')
    expect(() => validateBrandAssetDataUrl('data:image/png;base64,AAAA*===', 'image')).toThrow()
    expect(() =>
      validateBrandAssetDataUrl(dataUrl('text/plain', Buffer.alloc(2_000_001, 0x61)), 'document'),
    ).toThrow('解码后超过 2MB')
  })
})

describe('品牌资源接口安全', () => {
  it('在写入前拒绝危险 SVG', async () => {
    const token = await login('brand-svg-abuse@example.com')
    const response = await app.request('/api/brand-assets', {
      method: 'POST',
      headers: headers(token),
      body: JSON.stringify({
        kind: 'logo',
        name: '恶意 Logo',
        dataUrl: dataUrl(
          'image/svg+xml',
          '<svg xmlns="http://www.w3.org/2000/svg" onload="fetch(\'https://evil.example\')"></svg>',
        ),
        tags: [],
      }),
    })
    expect(response.status).toBe(400)
    expect((await response.json()).error.message).toContain('SVG')

    const listed = await app.request('/api/brand-assets', { headers: headers(token) })
    expect((await listed.json()).assets).toHaveLength(0)
  })

  it('修改种类时重新校验存量内容，并保持原资源不变', async () => {
    const token = await login('brand-kind-abuse@example.com')
    const createdResponse = await app.request('/api/brand-assets', {
      method: 'POST',
      headers: headers(token),
      body: JSON.stringify({
        kind: 'image',
        name: '安全图片',
        dataUrl: validPng(),
        tags: [],
      }),
    })
    expect(createdResponse.status).toBe(201)
    const asset = (await createdResponse.json()).asset

    const patched = await app.request(`/api/brand-assets/${asset.id}`, {
      method: 'PATCH',
      headers: headers(token),
      body: JSON.stringify({ kind: 'document' }),
    })
    expect(patched.status).toBe(400)
    expect((await patched.json()).error.message).toContain('文档资源仅支持')

    const listed = await app.request('/api/brand-assets', { headers: headers(token) })
    const stored = (await listed.json()).assets[0]
    expect(stored.kind).toBe('image')
    expect(stored.dataUrl).toBe(asset.dataUrl)
  })
})
