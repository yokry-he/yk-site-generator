import { beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../src/app'
import { resetDataStoreForTest } from '../src/lib/data-store'

const app = createApp()
const now = '2026-07-24T00:00:00.000Z'

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
        email: 'support@example.com',
        role: 'support',
        status: 'active',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: '00000000-0000-4000-8000-000000000003',
        email: 'member@example.com',
        role: 'user',
        status: 'active',
        createdAt: now,
        updatedAt: now,
      },
    ],
    feedback: [
      {
        id: '00000000-0000-4000-8000-000000000011',
        userId: '00000000-0000-4000-8000-000000000003',
        projectId: '00000000-0000-4000-8000-000000000012',
        versionId: '00000000-0000-4000-8000-000000000013',
        sentiment: 'negative',
        categories: ['layout'],
        message: '层级不够清晰',
        siteType: 'saas',
        model: 'test-model',
        status: 'open',
        createdAt: now,
        updatedAt: now,
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
  'x-request-id': 'operations-rbac-test',
})

describe('模板运营、功能开关与细粒度 RBAC', () => {
  it('支持人员按权限读取运营数据和处理反馈，但不能修改用户、模板或开关', async () => {
    const supportToken = await login('support@example.com')
    const authHeaders = headers(supportToken)

    const access = await app.request('/api/admin/access', { headers: authHeaders })
    expect(access.status).toBe(200)
    const permissions = (await access.json()).permissions as string[]
    expect(permissions).toContain('templates.read')
    expect(permissions).toContain('feedback.resolve')
    expect(permissions).not.toContain('feature_flags.read')

    expect((await app.request('/api/admin/overview', { headers: authHeaders })).status).toBe(200)
    expect((await app.request('/api/admin/users', { headers: authHeaders })).status).toBe(200)
    expect((await app.request('/api/admin/audit', { headers: authHeaders })).status).toBe(200)
    expect((await app.request('/api/admin/health', { headers: authHeaders })).status).toBe(200)

    const feedback = await app.request('/api/admin/feedback', { headers: authHeaders })
    expect(feedback.status).toBe(200)
    expect((await feedback.json()).feedback).toHaveLength(1)
    const resolve = await app.request('/api/admin/feedback/00000000-0000-4000-8000-000000000011', {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({ status: 'reviewed' }),
    })
    expect(resolve.status).toBe(200)

    const list = await app.request('/api/admin/templates', { headers: authHeaders })
    expect(list.status).toBe(200)
    const first = (await list.json()).templates[0]
    expect(first.operationVersion).toBe(0)

    const templateUpdate = await app.request(`/api/admin/templates/${first.id}`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({ status: 'draft', expectedVersion: 0 }),
    })
    expect(templateUpdate.status).toBe(403)
    expect((await templateUpdate.json()).error.code).toBe('PERMISSION_DENIED')

    const userUpdate = await app.request('/api/admin/users/00000000-0000-4000-8000-000000000003', {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({ status: 'suspended' }),
    })
    expect(userUpdate.status).toBe(403)
    expect((await userUpdate.json()).error.code).toBe('PERMISSION_DENIED')

    expect((await app.request('/api/admin/events', { headers: authHeaders })).status).toBe(403)
    expect((await app.request('/api/admin/feature-flags', { headers: authHeaders })).status).toBe(403)
  })

  it('管理员下架模板后，公开目录、详情和创建接口立即隐藏', async () => {
    const adminToken = await login('admin@example.com')
    const memberToken = await login('member@example.com')
    const list = await app.request('/api/admin/templates', { headers: headers(adminToken) })
    const target = (await list.json()).templates.find((item: { id: string }) => item.id === 'tpl-aurora-saas')
    expect(target).toBeTruthy()

    const updated = await app.request('/api/admin/templates/tpl-aurora-saas', {
      method: 'PATCH',
      headers: headers(adminToken),
      body: JSON.stringify({ status: 'draft', featured: false, sortOrder: 9, expectedVersion: 0 }),
    })
    expect(updated.status).toBe(200)
    expect((await updated.json()).template).toMatchObject({
      status: 'draft',
      featured: false,
      sortOrder: 9,
      operationVersion: 1,
    })

    const publicList = await app.request('/api/templates')
    expect(publicList.status).toBe(200)
    expect((await publicList.json()).templates.some((item: { id: string }) => item.id === 'tpl-aurora-saas')).toBe(false)

    const detail = await app.request('/api/templates/tpl-aurora-saas')
    expect(detail.status).toBe(404)

    const use = await app.request('/api/templates/tpl-aurora-saas/use', {
      method: 'POST',
      headers: headers(memberToken),
      body: JSON.stringify({ variables: {} }),
    })
    expect(use.status).toBe(404)

    const conflict = await app.request('/api/admin/templates/tpl-aurora-saas', {
      method: 'PATCH',
      headers: headers(adminToken),
      body: JSON.stringify({ status: 'published', expectedVersion: 0 }),
    })
    expect(conflict.status).toBe(409)
    expect((await conflict.json()).error.code).toBe('VERSION_CONFLICT')
  })

  it('管理员关闭模板中心后公开 API 返回功能关闭，并生成审计日志', async () => {
    const adminToken = await login('admin@example.com')
    const flags = await app.request('/api/admin/feature-flags', { headers: headers(adminToken) })
    expect(flags.status).toBe(200)
    const templateFlag = (await flags.json()).flags.find((item: { key: string }) => item.key === 'official-templates')
    expect(templateFlag.version).toBe(0)

    const update = await app.request('/api/admin/feature-flags/official-templates', {
      method: 'PUT',
      headers: headers(adminToken),
      body: JSON.stringify({
        enabled: false,
        rolloutPercent: 0,
        expectedVersion: 0,
      }),
    })
    expect(update.status).toBe(200)
    expect((await update.json()).flag).toMatchObject({ enabled: false, rolloutPercent: 0, version: 1 })

    const publicList = await app.request('/api/templates')
    expect(publicList.status).toBe(503)
    expect((await publicList.json()).error.code).toBe('FEATURE_DISABLED')

    const audit = await app.request('/api/admin/audit?action=admin.feature_flag.update', {
      headers: headers(adminToken),
    })
    expect(audit.status).toBe(200)
    expect((await audit.json()).auditLogs[0]).toMatchObject({
      action: 'admin.feature_flag.update',
      resourceId: 'official-templates',
      requestId: 'operations-rbac-test',
      outcome: 'success',
    })
  })
})
