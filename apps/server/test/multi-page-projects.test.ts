import { beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../src/app'
import { resetDataStoreForTest } from '../src/lib/data-store'

const app = createApp()
const now = '2026-07-25T00:00:00.000Z'
const userId = '00000000-0000-4000-8000-000000000901'
const projectIdPattern = /^[0-9a-f-]{36}$/u
const homeHtml = '<!doctype html><html><body><h1>Home</h1></body></html>'
const aboutHtml = '<!doctype html><html><body><h1>About</h1></body></html>'

beforeEach(() => {
  resetDataStoreForTest({
    users: [{ id: userId, email: 'pages@example.com', role: 'user', status: 'active', createdAt: now, updatedAt: now }],
  })
})

async function login(): Promise<string> {
  const request = await app.request('/api/auth/request-code', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'pages@example.com' }),
  })
  expect(request.status).toBe(202)
  const code = (await request.json()).debugCode as string
  const response = await app.request('/api/auth/verify', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'pages@example.com', code }),
  })
  expect(response.status).toBe(200)
  return (await response.json()).accessToken as string
}

function headers(token: string): Record<string, string> {
  return { authorization: `Bearer ${token}`, 'content-type': 'application/json' }
}

describe('multi-page projects', () => {
  it('creates, reads, and rolls back an immutable whole-site version', async () => {
    const token = await login()
    const createdResponse = await app.request('/api/projects', {
      method: 'POST',
      headers: headers(token),
      body: JSON.stringify({
        title: '多页面测试',
        siteType: 'business',
        requirement: '测试多页面',
        source: 'import',
        homePageId: 'home',
        pages: [
          { id: 'home', title: '首页', path: '/', html: homeHtml },
          { id: 'about', title: '关于', path: '/about', html: aboutHtml },
        ],
      }),
    })
    expect(createdResponse.status).toBe(201)
    const created = await createdResponse.json() as { project: { id: string; latestVersion: { id: string; pageCount: number } } }
    expect(created.project.id).toMatch(projectIdPattern)
    expect(created.project.latestVersion.pageCount).toBe(2)

    const versionResponse = await app.request(`/api/projects/${created.project.id}/versions/${created.project.latestVersion.id}`, { headers: headers(token) })
    expect(versionResponse.status).toBe(200)
    const version = await versionResponse.json() as { version: { pages: Array<{ path: string; html: string }>; homePageId: string; pageCount: number } }
    expect(version.version.pageCount).toBe(2)
    expect(version.version.pages.map((page) => page.path)).toEqual(['/', '/about'])
    expect(version.version.pages[1].html).toContain('About')

    const secondResponse = await app.request(`/api/projects/${created.project.id}/versions`, {
      method: 'POST',
      headers: headers(token),
      body: JSON.stringify({
        source: 'editor',
        parentVersionId: created.project.latestVersion.id,
        homePageId: 'about',
        pages: [
          { id: 'home', title: '首页', path: '/home', html: homeHtml },
          { id: 'about', title: '关于', path: '/', html: aboutHtml.replace('About', 'New home') },
          { id: 'contact', title: '联系', path: '/contact', html: '<!doctype html><html><body>Contact</body></html>' },
        ],
      }),
    })
    expect(secondResponse.status).toBe(201)
    const second = await secondResponse.json() as { version: { id: string; pageCount: number; changeSummary: string[] } }
    expect(second.version.pageCount).toBe(3)
    expect(second.version.changeSummary.join(' ')).toContain('页面数量 2 → 3')

    const legacyHomeUpdate = '<!doctype html><html><body><h1>Legacy editor changed only home</h1></body></html>'
    const legacyResponse = await app.request(`/api/projects/${created.project.id}/versions`, {
      method: 'POST',
      headers: headers(token),
      body: JSON.stringify({
        source: 'editor',
        parentVersionId: second.version.id,
        html: legacyHomeUpdate,
      }),
    })
    expect(legacyResponse.status).toBe(201)
    const legacy = await legacyResponse.json() as { version: { id: string; pageCount: number } }
    expect(legacy.version.pageCount).toBe(3)
    const legacyFullResponse = await app.request(`/api/projects/${created.project.id}/versions/${legacy.version.id}`, { headers: headers(token) })
    const legacyFull = await legacyFullResponse.json() as { version: { homePageId: string; pages: Array<{ id: string; path: string; html: string }> } }
    expect(legacyFull.version.pages).toHaveLength(3)
    expect(legacyFull.version.pages.find((page) => page.id === legacyFull.version.homePageId)?.html).toBe(legacyHomeUpdate)
    expect(legacyFull.version.pages.find((page) => page.path === '/contact')?.html).toContain('Contact')

    const rollbackResponse = await app.request(`/api/projects/${created.project.id}/rollback`, {
      method: 'POST',
      headers: headers(token),
      body: JSON.stringify({ versionId: created.project.latestVersion.id }),
    })
    expect(rollbackResponse.status).toBe(201)
    const rollback = await rollbackResponse.json() as { version: { id: string; pageCount: number } }
    expect(rollback.version.pageCount).toBe(2)

    const rolledVersionResponse = await app.request(`/api/projects/${created.project.id}/versions/${rollback.version.id}`, { headers: headers(token) })
    const rolled = await rolledVersionResponse.json() as { version: { pages: Array<{ path: string }> } }
    expect(rolled.version.pages.map((page) => page.path)).toEqual(['/', '/about'])
  })

  it('rejects duplicate routes before persistence', async () => {
    const token = await login()
    const response = await app.request('/api/projects', {
      method: 'POST',
      headers: headers(token),
      body: JSON.stringify({
        title: '非法路径',
        siteType: 'business',
        requirement: '',
        pages: [
          { id: 'one', title: 'One', path: '/', html: homeHtml },
          { id: 'two', title: 'Two', path: '/', html: aboutHtml },
        ],
        homePageId: 'one',
      }),
    })
    expect(response.status).toBe(400)
  })
})
