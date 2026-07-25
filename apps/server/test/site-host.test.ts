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
  it('旧单页发布通过任意 GET 路径返回入口 HTML', async () => {
    const response = await app.request('http://brand-site.siteforge.local/products/detail', {
      headers: { host: 'brand-site.siteforge.local' },
    })
    expect(response.status).toBe(200)
    expect(await response.text()).toContain('<h1>Published</h1>')
    expect(response.headers.get('content-security-policy')).toContain('sandbox')
  })

  it('多页面发布按路径返回页面并对未知路径返回 404', async () => {
    resetDataStoreForTest({
      publications: [
        {
          id: 'publication-pages',
          userId: 'user-1',
          slug: 'multi-site',
          title: '多页面站点',
          html,
          homePageId: 'home',
          pages: [
            { id: 'home', title: '首页', path: '/', html },
            { id: 'about', title: '关于', path: '/about', html: '<!doctype html><html><body><h1>About page</h1></body></html>' },
          ],
          status: 'published',
          createdAt: '2026-07-25T00:00:00.000Z',
          updatedAt: '2026-07-25T00:00:00.000Z',
          publishedAt: '2026-07-25T00:00:00.000Z',
        },
      ],
    })

    const about = await app.request('http://multi-site.siteforge.local/about', {
      headers: { host: 'multi-site.siteforge.local' },
    })
    expect(about.status).toBe(200)
    expect(await about.text()).toContain('About page')
    expect(about.headers.get('x-siteforge-page')).toBe('/about')

    const missing = await app.request('http://multi-site.siteforge.local/missing', {
      headers: { host: 'multi-site.siteforge.local' },
    })
    expect(missing.status).toBe(404)
    expect(await missing.text()).toContain('页面不存在')
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
