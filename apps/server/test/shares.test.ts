import { beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../src/app'
import { cleanupExpiredShares, resetShareStoreForTest } from '../src/lib/share-store'

const app = createApp()
const html = '<!DOCTYPE html><html><head><title>测试分享</title></head><body><h1>你好</h1><script>document.body.dataset.ready="1"</script></body></html>'

beforeEach(() => resetShareStoreForTest())

describe('临时分享 API', () => {
  it('创建、读取元信息并渲染沙箱分享页', async () => {
    const created = await app.request('/api/shares', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ html, title: '测试分享', siteType: 'personal' }),
    })
    expect(created.status).toBe(201)
    const body = await created.json()
    expect(body.share.path).toMatch(/^\/s\/[\w-]+$/)
    expect(body.share.expiresAt).toBeTruthy()
    expect(body.deleteToken.length).toBeGreaterThan(20)

    const meta = await app.request(`/api/shares/${body.share.id}`)
    expect(meta.status).toBe(200)
    expect((await meta.json()).share.title).toBe('测试分享')

    const page = await app.request(body.share.path)
    expect(page.status).toBe(200)
    expect(page.headers.get('x-content-type-options')).toBe('nosniff')
    expect(page.headers.get('referrer-policy')).toBe('no-referrer')
    const pageText = await page.text()
    expect(pageText).toContain('sandbox="allow-scripts"')
    expect(pageText).toContain('到期时间')
    expect(pageText).toContain('&lt;h1&gt;你好&lt;/h1&gt;')
  })

  it('删除令牌错误时拒绝,正确时立即失效', async () => {
    const created = await app.request('/api/shares', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ html }),
    })
    const body = await created.json()

    const denied = await app.request(`/api/shares/${body.share.id}`, {
      method: 'DELETE',
      headers: { 'x-share-delete-token': 'wrong-token' },
    })
    expect(denied.status).toBe(403)

    const deleted = await app.request(`/api/shares/${body.share.id}`, {
      method: 'DELETE',
      headers: { 'x-share-delete-token': body.deleteToken },
    })
    expect(deleted.status).toBe(200)
    expect((await app.request(body.share.path)).status).toBe(404)
  })

  it('过期清理后分享页返回友好 404', async () => {
    const created = await app.request('/api/shares', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ html }),
    })
    const body = await created.json()
    await cleanupExpiredShares(Date.now() + 8 * 86_400_000)
    const page = await app.request(body.share.path)
    expect(page.status).toBe(404)
    expect(await page.text()).toContain('分享不存在或已过期')
  })

  it('请求体超过上限时在解析前返回 413', async () => {
    const res = await app.request('/api/shares', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'content-length': String(3 * 1024 * 1024),
      },
      body: JSON.stringify({ html }),
    })
    expect(res.status).toBe(413)
    expect((await res.json()).error.code).toBe('SHARE_TOO_LARGE')
  })
})
