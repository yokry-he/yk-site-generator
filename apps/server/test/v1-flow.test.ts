import { beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../src/app'
import { resetDataStoreForTest } from '../src/lib/data-store'

const app = createApp()
const htmlV1 = '<!DOCTYPE html><html><head><title>V1</title></head><body><h1>第一版</h1></body></html>'
const htmlV2 = '<!DOCTYPE html><html><head><title>V2</title></head><body><h1>第二版</h1></body></html>'

beforeEach(() => resetDataStoreForTest())

async function login(email = 'owner@example.com') {
  const requested = await app.request('/api/auth/request-code', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email }),
  })
  expect(requested.status).toBe(202)
  const requestBody = await requested.json()
  expect(requestBody.debugCode).toMatch(/^\d{6}$/)

  const verified = await app.request('/api/auth/verify', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, code: requestBody.debugCode }),
  })
  expect(verified.status).toBe(200)
  const body = await verified.json()
  return {
    token: body.accessToken as string,
    user: body.user as { id: string; email: string },
    cookie: verified.headers.get('set-cookie') ?? '',
  }
}

function authHeaders(token: string): Record<string, string> {
  return { authorization: `Bearer ${token}`, 'content-type': 'application/json' }
}

describe('V1 核心流程', () => {
  it('验证码登录、项目版本、回滚、发布、下线和登出完整闭环', async () => {
    const session = await login()

    const me = await app.request('/api/auth/me', {
      headers: { authorization: `Bearer ${session.token}` },
    })
    expect(me.status).toBe(200)
    expect((await me.json()).user.email).toBe('owner@example.com')

    const created = await app.request('/api/projects', {
      method: 'POST',
      headers: authHeaders(session.token),
      body: JSON.stringify({
        title: '我的品牌站',
        siteType: 'corporate',
        requirement: '现代企业官网',
        html: htmlV1,
        source: 'generate',
        model: 'test-model',
      }),
    })
    expect(created.status).toBe(201)
    const project = (await created.json()).project
    expect(project.latestVersion.version).toBe(1)

    const v2Res = await app.request(`/api/projects/${project.id}/versions`, {
      method: 'POST',
      headers: authHeaders(session.token),
      body: JSON.stringify({
        html: htmlV2,
        source: 'iterate',
        instruction: '标题改成第二版',
        model: 'test-model',
      }),
    })
    expect(v2Res.status).toBe(201)
    const version2 = (await v2Res.json()).version
    expect(version2.version).toBe(2)

    const detail = await app.request(`/api/projects/${project.id}`, {
      headers: { authorization: `Bearer ${session.token}` },
    })
    const detailBody = await detail.json()
    expect(detailBody.versions.map((item: { version: number }) => item.version)).toEqual([2, 1])

    const rollback = await app.request(`/api/projects/${project.id}/rollback`, {
      method: 'POST',
      headers: authHeaders(session.token),
      body: JSON.stringify({ versionId: project.latestVersion.id }),
    })
    expect(rollback.status).toBe(201)
    expect((await rollback.json()).version.version).toBe(3)

    const publicationRes = await app.request('/api/publications', {
      method: 'POST',
      headers: authHeaders(session.token),
      body: JSON.stringify({
        title: '我的品牌站',
        projectId: project.id,
        versionId: version2.id,
        slug: 'my-brand-site',
      }),
    })
    expect(publicationRes.status).toBe(201)
    const publication = (await publicationRes.json()).publication
    expect(publication.url).toContain('/site/my-brand-site')

    const publicPage = await app.request('/site/my-brand-site')
    expect(publicPage.status).toBe(200)
    expect(await publicPage.text()).toContain('第二版')
    expect(publicPage.headers.get('content-security-policy')).toContain('sandbox')

    const offline = await app.request(`/api/publications/${publication.id}`, {
      method: 'PATCH',
      headers: authHeaders(session.token),
      body: JSON.stringify({ status: 'offline' }),
    })
    expect(offline.status).toBe(200)
    expect((await app.request('/site/my-brand-site')).status).toBe(404)

    const quota = await app.request('/api/quota', {
      headers: { authorization: `Bearer ${session.token}` },
    })
    expect(quota.status).toBe(200)
    expect((await quota.json()).quota.byAction.publish).toBe(1)

    const logout = await app.request('/api/auth/logout', {
      method: 'POST',
      headers: { authorization: `Bearer ${session.token}` },
    })
    expect(logout.status).toBe(200)
    expect(
      (
        await app.request('/api/auth/me', {
          headers: { authorization: `Bearer ${session.token}` },
        })
      ).status,
    ).toBe(401)
  })

  it('验证码限制错误次数并支持刷新令牌轮换', async () => {
    const requested = await app.request('/api/auth/request-code', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'refresh@example.com' }),
    })
    const debugCode = (await requested.json()).debugCode

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const wrong = await app.request('/api/auth/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'refresh@example.com', code: '000000' }),
      })
      expect(wrong.status).toBe(400)
    }

    const verified = await app.request('/api/auth/verify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'refresh@example.com', code: debugCode }),
    })
    expect(verified.status).toBe(200)
    const cookie = verified.headers.get('set-cookie') ?? ''
    expect(cookie).toContain('sf_refresh=')
    expect(cookie.toLowerCase()).toContain('httponly')

    const refreshed = await app.request('/api/auth/refresh', {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json' },
      body: '{}',
    })
    expect(refreshed.status).toBe(200)
    expect((await refreshed.json()).accessToken).toBeTruthy()
    expect(refreshed.headers.get('set-cookie')).not.toBe(cookie)
  })
})
