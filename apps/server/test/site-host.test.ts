import { beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../src/app'
import { resetDataStoreForTest } from '../src/lib/data-store'

const app = createApp()
const html = '<!doctype html><html><head><title>子域名站点</title></head><body><h1>Published</h1></body></html>'

beforeEach(() => {
  resetDataStoreForTest({
    publications: [
      {
        id: 'publication-1',
        userId: 'user-1',
        slug: 'brand-site',
        title: '品牌站',
        html,
        status: 'published',
        createdAt: '2026-07-23T00:00:00.000Z',
        updatedAt: '2026-07-23T00:00:00.000Z',
        publishedAt: '2026-07-23T00:00:00.000Z',
      },
    ],
  })
})

describe('发布站点子域名路由', () => {
  it('通过 slug.siteforge.local 的任意 GET 路径返回入口 HTML', async () => {
    const response = await app.request('http://brand-site.siteforge.local/products/detail', {
      headers: { host: 'brand-site.siteforge.local' },
    })
    expect(response.status).toBe(200)
    expect(await response.text()).toContain('<h1>Published</h1>')
    expect(response.headers.get('content-security-policy')).toContain('sandbox')
  })

  it('平台主域名和嵌套子域名不会被误识别为站点 slug', async () => {
    const apex = await app.request('http://siteforge.local/', { headers: { host: 'siteforge.local' } })
    expect(apex.status).toBe(404)
    expect(apex.headers.get('content-type')).toContain('application/json')

    const nested = await app.request('http://a.brand-site.siteforge.local/', {
      headers: { host: 'a.brand-site.siteforge.local' },
    })
    expect(nested.status).toBe(404)
    expect(nested.headers.get('content-type')).toContain('application/json')
  })
})
