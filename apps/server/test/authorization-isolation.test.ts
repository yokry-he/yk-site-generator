import { beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../src/app'
import { resetDataStoreForTest } from '../src/lib/data-store'

const app = createApp()
const html = '<!doctype html><html><head><title>Private</title></head><body>private</body></html>'

beforeEach(() => resetDataStoreForTest())

async function login(email: string): Promise<string> {
  const request = await app.request('/api/auth/request-code', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email }),
  })
  const code = (await request.json()).debugCode
  const verify = await app.request('/api/auth/verify', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, code }),
  })
  return (await verify.json()).accessToken
}

function headers(token: string) {
  return { authorization: `Bearer ${token}`, 'content-type': 'application/json' }
}

describe('账号资源隔离', () => {
  it('其他账号无法读取、修改、回滚或发布项目版本', async () => {
    const ownerToken = await login('owner-isolation@example.com')
    const strangerToken = await login('stranger-isolation@example.com')

    const created = await app.request('/api/projects', {
      method: 'POST',
      headers: headers(ownerToken),
      body: JSON.stringify({
        title: '私有项目',
        siteType: 'personal',
        requirement: '仅所有者可见',
        html,
        source: 'generate',
      }),
    })
    const project = (await created.json()).project

    expect(
      (await app.request(`/api/projects/${project.id}`, { headers: headers(strangerToken) })).status,
    ).toBe(404)
    expect(
      (
        await app.request(`/api/projects/${project.id}`, {
          method: 'PATCH',
          headers: headers(strangerToken),
          body: JSON.stringify({ title: '篡改' }),
        })
      ).status,
    ).toBe(404)
    expect(
      (
        await app.request(`/api/projects/${project.id}/rollback`, {
          method: 'POST',
          headers: headers(strangerToken),
          body: JSON.stringify({ versionId: project.latestVersion.id }),
        })
      ).status,
    ).toBe(404)
    expect(
      (
        await app.request('/api/publications', {
          method: 'POST',
          headers: headers(strangerToken),
          body: JSON.stringify({
            title: '越权发布',
            projectId: project.id,
            versionId: project.latestVersion.id,
          }),
        })
      ).status,
    ).toBe(404)

    const ownerDetail = await app.request(`/api/projects/${project.id}`, {
      headers: headers(ownerToken),
    })
    expect(ownerDetail.status).toBe(200)
    expect((await ownerDetail.json()).project.title).toBe('私有项目')
  })

  it('登出撤销后旧访问令牌立即失效', async () => {
    const token = await login('revoke@example.com')
    expect((await app.request('/api/auth/me', { headers: headers(token) })).status).toBe(200)
    expect(
      (
        await app.request('/api/auth/logout', {
          method: 'POST',
          headers: headers(token),
        })
      ).status,
    ).toBe(200)
    expect((await app.request('/api/auth/me', { headers: headers(token) })).status).toBe(401)
  })
})
