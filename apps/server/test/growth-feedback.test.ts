import { beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../src/app'
import { resetDataStoreForTest } from '../src/lib/data-store'

const app = createApp()
const memberId = '10000000-0000-4000-8000-000000000001'
const otherId = '10000000-0000-4000-8000-000000000002'
const adminId = '10000000-0000-4000-8000-000000000003'
const projectId = '20000000-0000-4000-8000-000000000001'
const versionId = '30000000-0000-4000-8000-000000000001'
const now = '2026-07-23T00:00:00.000Z'

beforeEach(() => {
  resetDataStoreForTest({
    users: [
      { id: memberId, email: 'growth@example.com', role: 'user', status: 'active', createdAt: now, updatedAt: now },
      { id: otherId, email: 'other-growth@example.com', role: 'user', status: 'active', createdAt: now, updatedAt: now },
      { id: adminId, email: 'growth-admin@example.com', role: 'admin', status: 'active', createdAt: now, updatedAt: now },
    ],
    projects: [
      { id: projectId, userId: memberId, title: '反馈项目', siteType: 'saas', requirement: '测试反馈', createdAt: now, updatedAt: now },
    ],
    projectVersions: [
      { id: versionId, projectId, userId: memberId, version: 1, html: '<!doctype html><html><body>test</body></html>', source: 'generate', model: 'test-model', createdAt: now },
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

function headers(token: string): Record<string, string> {
  return { authorization: `Bearer ${token}`, 'content-type': 'application/json', 'x-request-id': 'growth-feedback-test-01' }
}

describe('新手引导进度', () => {
  it('可跨请求保存、跳过、重置与完成', async () => {
    const token = await login('growth@example.com')
    const initial = await app.request('/api/onboarding', { headers: headers(token) })
    expect(initial.status).toBe(200)
    const initialBody = await initial.json()
    expect(initialBody.progress.currentStep).toBe('welcome')
    expect(initialBody.checklist.find((item: { id: string }) => item.id === 'project').completed).toBe(true)

    const updated = await app.request('/api/onboarding', {
      method: 'PATCH',
      headers: headers(token),
      body: JSON.stringify({
        currentStep: 'starter',
        completedSteps: ['welcome', 'goal'],
        context: { goal: 'business', siteType: 'saas', starter: 'template' },
      }),
    })
    expect(updated.status).toBe(200)
    expect((await updated.json()).progress.context.siteType).toBe('saas')

    const dismissed = await app.request('/api/onboarding/dismiss', { method: 'POST', headers: headers(token) })
    expect((await dismissed.json()).progress.dismissedAt).toBeTruthy()

    const reset = await app.request('/api/onboarding/reset', { method: 'POST', headers: headers(token) })
    expect((await reset.json()).progress.currentStep).toBe('welcome')

    const completed = await app.request('/api/onboarding/complete', { method: 'POST', headers: headers(token) })
    const completedBody = await completed.json()
    expect(completedBody.progress.currentStep).toBe('ready')
    expect(completedBody.progress.completedAt).toBeTruthy()
  })
})

describe('项目版本质量反馈', () => {
  it('同一用户和版本幂等更新反馈', async () => {
    const token = await login('growth@example.com')
    const first = await app.request('/api/feedback', {
      method: 'POST',
      headers: headers(token),
      body: JSON.stringify({
        projectId,
        versionId,
        sentiment: 'negative',
        categories: ['layout', 'mobile'],
        message: '手机端首屏需要优化',
      }),
    })
    expect(first.status).toBe(201)
    const firstBody = await first.json()
    expect(firstBody.feedback.siteType).toBe('saas')
    expect(firstBody.feedback.model).toBe('test-model')

    const second = await app.request('/api/feedback', {
      method: 'POST',
      headers: headers(token),
      body: JSON.stringify({ projectId, versionId, sentiment: 'positive', categories: ['layout'] }),
    })
    expect(second.status).toBe(200)
    const secondBody = await second.json()
    expect(secondBody.feedback.id).toBe(firstBody.feedback.id)
    expect(secondBody.feedback.sentiment).toBe('positive')
    expect(secondBody.feedback.status).toBe('open')

    const mine = await app.request(`/api/feedback/mine?projectId=${projectId}&versionId=${versionId}`, { headers: headers(token) })
    expect((await mine.json()).feedback.id).toBe(firstBody.feedback.id)
  })

  it('不能对其他用户的项目版本提交反馈', async () => {
    const token = await login('other-growth@example.com')
    const response = await app.request('/api/feedback', {
      method: 'POST',
      headers: headers(token),
      body: JSON.stringify({ projectId, versionId, sentiment: 'negative', categories: ['error'] }),
    })
    expect(response.status).toBe(404)
  })

  it('管理员可查看、处理反馈并生成审计记录', async () => {
    const memberToken = await login('growth@example.com')
    const created = await app.request('/api/feedback', {
      method: 'POST',
      headers: headers(memberToken),
      body: JSON.stringify({ projectId, versionId, sentiment: 'negative', categories: ['copy'], message: '文案太长' }),
    })
    const feedbackId = (await created.json()).feedback.id as string

    const adminToken = await login('growth-admin@example.com')
    const list = await app.request('/api/admin/feedback?sentiment=negative', { headers: headers(adminToken) })
    expect(list.status).toBe(200)
    const listBody = await list.json()
    expect(listBody.feedback).toHaveLength(1)
    expect(listBody.summary.negativeRate).toBe(100)
    expect(listBody.summary.topCategories[0]).toMatchObject({ category: 'copy', count: 1 })

    const resolved = await app.request(`/api/admin/feedback/${feedbackId}`, {
      method: 'PATCH',
      headers: headers(adminToken),
      body: JSON.stringify({ status: 'resolved' }),
    })
    expect(resolved.status).toBe(200)

    const audit = await app.request('/api/admin/audit?action=admin.feedback.status.update', { headers: headers(adminToken) })
    const auditBody = await audit.json()
    expect(auditBody.auditLogs).toHaveLength(1)
    expect(auditBody.auditLogs[0]).toMatchObject({ resourceId: feedbackId, outcome: 'success' })
  })
})
