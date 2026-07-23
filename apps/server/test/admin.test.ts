import { beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../src/app'
import { resetDataStoreForTest } from '../src/lib/data-store'

const app = createApp()
const now = '2026-07-23T00:00:00.000Z'

beforeEach(() => {
  resetDataStoreForTest({
    users: [
      {
        id: '00000000-0000-4000-8000-000000000001',
        email: 'admin@example.com',
        role: 'admin',
        status: 'active',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: '00000000-0000-4000-8000-000000000002',
        email: 'member@example.com',
        role: 'user',
        status: 'active',
        createdAt: now,
        updatedAt: now,
      },
    ],
    projects: [
      {
        id: '00000000-0000-4000-8000-000000000010',
        userId: '00000000-0000-4000-8000-000000000002',
        title: '模板项目',
        siteType: 'saas',
        requirement: '测试',
        templateId: 'tpl-aurora-saas',
        createdAt: now,
        updatedAt: now,
      },
    ],
    usage: [
      {
        id: '00000000-0000-4000-8000-000000000020',
        userId: '00000000-0000-4000-8000-000000000002',
        action: 'generate',
        units: 1,
        createdAt: new Date().toISOString(),
      },
    ],
  })
})

async function login(email: string): Promise<string> {
  const requested = await app.request('/api/auth/request-code', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email }),
  })
  expect(requested.status).toBe(202)
  const code = (await requested.json()).debugCode as string
  const verified = await app.request('/api/auth/verify', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, code }),
  })
  expect(verified.status).toBe(200)
  return ((await verified.json()).accessToken as string)
}

const headers = (token: string): Record<string, string> => ({
  authorization: `Bearer ${token}`,
  'content-type': 'application/json',
  'x-request-id': 'admin-test-request-0001',
})

describe('管理后台与可观测性', () => {
  it('普通用户被拒绝，管理员可读取概览与健康状态', async () => {
    const memberToken = await login('member@example.com')
    const forbidden = await app.request('/api/admin/overview', {
      headers: { authorization: `Bearer ${memberToken}` },
    })
    expect(forbidden.status).toBe(403)

    const adminToken = await login('admin@example.com')
    const overview = await app.request('/api/admin/overview', { headers: headers(adminToken) })
    expect(overview.status).toBe(200)
    expect(overview.headers.get('x-request-id')).toBe('admin-test-request-0001')
    const body = await overview.json()
    expect(body.overview.users.total).toBe(2)
    expect(body.overview.projects.fromTemplates).toBe(1)
    expect(body.overview.assets.officialTemplates).toBeGreaterThanOrEqual(10)

    const health = await app.request('/api/admin/health', { headers: headers(adminToken) })
    expect(health.status).toBe(200)
    expect((await health.json()).health.components.some((item: { id: string }) => item.id === 'mysql')).toBe(true)
  })

  it('限制账号会立即撤销会话并写入审计日志', async () => {
    const memberToken = await login('member@example.com')
    const adminToken = await login('admin@example.com')

    const updated = await app.request('/api/admin/users/00000000-0000-4000-8000-000000000002', {
      method: 'PATCH',
      headers: headers(adminToken),
      body: JSON.stringify({ status: 'suspended' }),
    })
    expect(updated.status).toBe(200)
    expect((await updated.json()).user.status).toBe('suspended')

    const memberMe = await app.request('/api/auth/me', {
      headers: { authorization: `Bearer ${memberToken}` },
    })
    expect(memberMe.status).toBe(401)

    const logs = await app.request('/api/admin/audit?action=admin.user.update', {
      headers: headers(adminToken),
    })
    expect(logs.status).toBe(200)
    const audit = (await logs.json()).auditLogs
    expect(audit).toHaveLength(1)
    expect(audit[0]).toMatchObject({
      actorUserId: '00000000-0000-4000-8000-000000000001',
      resourceId: '00000000-0000-4000-8000-000000000002',
      outcome: 'success',
      requestId: 'admin-test-request-0001',
    })
    expect(audit[0].beforeData.status).toBe('active')
    expect(audit[0].afterData.status).toBe('suspended')
  })

  it('阻止管理员降低自己的权限或限制自身账号', async () => {
    const adminToken = await login('admin@example.com')
    const demote = await app.request('/api/admin/users/00000000-0000-4000-8000-000000000001', {
      method: 'PATCH',
      headers: headers(adminToken),
      body: JSON.stringify({ role: 'user' }),
    })
    expect(demote.status).toBe(409)

    const suspend = await app.request('/api/admin/users/00000000-0000-4000-8000-000000000001', {
      method: 'PATCH',
      headers: headers(adminToken),
      body: JSON.stringify({ status: 'suspended' }),
    })
    expect(suspend.status).toBe(409)
  })
})
