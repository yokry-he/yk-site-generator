import { beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../src/app'
import {
  resetDataStoreForTest,
  type FeatureFlagRecord,
} from '../src/lib/data-store'

const app = createApp()
const now = '2026-07-24T00:00:00.000Z'
const userId = '00000000-0000-4000-8000-000000000101'
const projectId = '00000000-0000-4000-8000-000000000102'
const versionId = '00000000-0000-4000-8000-000000000103'

beforeEach(() => {
  resetDataStoreForTest({
    users: [{
      id: userId,
      email: 'member@example.com',
      role: 'user',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    }],
    projects: [{
      id: projectId,
      userId,
      title: 'Feature Gate Project',
      siteType: 'saas',
      requirement: 'test',
      createdAt: now,
      updatedAt: now,
    }],
    projectVersions: [{
      id: versionId,
      projectId,
      userId,
      version: 1,
      html: '<!doctype html><html><body><h1>Feature gate</h1></body></html>',
      source: 'generate',
      createdAt: now,
    }],
  })
})

async function login(): Promise<string> {
  const requested = await app.request('/api/auth/request-code', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'member@example.com' }),
  })
  const code = (await requested.json()).debugCode as string
  const verified = await app.request('/api/auth/verify', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'member@example.com', code }),
  })
  expect(verified.status).toBe(200)
  return (await verified.json()).accessToken as string
}

function disabledFlag(key: string): FeatureFlagRecord {
  return {
    key,
    enabled: false,
    rolloutPercent: 0,
    description: `${key} disabled for test`,
    rules: {},
    version: 1,
    updatedBy: userId,
    createdAt: now,
    updatedAt: now,
  }
}

async function assertDisabled(response: Response): Promise<void> {
  expect(response.status).toBe(503)
  expect((await response.json()).error.code).toBe('FEATURE_DISABLED')
}

describe('用户能力功能开关', () => {
  it('关闭品牌套件后读取接口被服务端拒绝', async () => {
    resetDataStoreForTest({
      users: [{ id: userId, email: 'member@example.com', role: 'user', status: 'active', createdAt: now, updatedAt: now }],
      featureFlags: [disabledFlag('brand-kits')],
    })
    const token = await login()
    await assertDisabled(await app.request('/api/brand-kits', {
      headers: { authorization: `Bearer ${token}` },
    }))
  })

  it('关闭新手引导后进度接口被服务端拒绝', async () => {
    resetDataStoreForTest({
      users: [{ id: userId, email: 'member@example.com', role: 'user', status: 'active', createdAt: now, updatedAt: now }],
      featureFlags: [disabledFlag('onboarding-guide')],
    })
    const token = await login()
    await assertDisabled(await app.request('/api/onboarding', {
      headers: { authorization: `Bearer ${token}` },
    }))
  })

  it('关闭质量反馈后读取和提交入口被服务端拒绝', async () => {
    resetDataStoreForTest({
      users: [{ id: userId, email: 'member@example.com', role: 'user', status: 'active', createdAt: now, updatedAt: now }],
      projects: [{ id: projectId, userId, title: 'Project', siteType: 'saas', requirement: '', createdAt: now, updatedAt: now }],
      projectVersions: [{ id: versionId, projectId, userId, version: 1, html: '<html><body>feedback</body></html>', source: 'generate', createdAt: now }],
      featureFlags: [disabledFlag('quality-feedback')],
    })
    const token = await login()
    const authHeaders = { authorization: `Bearer ${token}`, 'content-type': 'application/json' }
    await assertDisabled(await app.request(`/api/feedback/mine?projectId=${projectId}&versionId=${versionId}`, {
      headers: authHeaders,
    }))
    await assertDisabled(await app.request('/api/feedback', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ projectId, versionId, sentiment: 'positive' }),
    }))
  })

  it('关闭发布后列表和创建接口被服务端拒绝', async () => {
    resetDataStoreForTest({
      users: [{ id: userId, email: 'member@example.com', role: 'user', status: 'active', createdAt: now, updatedAt: now }],
      projects: [{ id: projectId, userId, title: 'Project', siteType: 'saas', requirement: '', createdAt: now, updatedAt: now }],
      projectVersions: [{ id: versionId, projectId, userId, version: 1, html: '<html><body>publish</body></html>', source: 'generate', createdAt: now }],
      featureFlags: [disabledFlag('site-publishing')],
    })
    const token = await login()
    const authHeaders = { authorization: `Bearer ${token}`, 'content-type': 'application/json' }
    await assertDisabled(await app.request('/api/publications', { headers: authHeaders }))
    await assertDisabled(await app.request('/api/publications', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ title: 'Blocked publication', versionId }),
    }))
  })

  it('关闭可视化编辑器后 editor 来源版本被拒绝，其他版本仍可创建', async () => {
    resetDataStoreForTest({
      users: [{ id: userId, email: 'member@example.com', role: 'user', status: 'active', createdAt: now, updatedAt: now }],
      projects: [{ id: projectId, userId, title: 'Project', siteType: 'saas', requirement: '', createdAt: now, updatedAt: now }],
      projectVersions: [{ id: versionId, projectId, userId, version: 1, html: '<html><body>base</body></html>', source: 'generate', createdAt: now }],
      featureFlags: [disabledFlag('visual-editor')],
    })
    const token = await login()
    const authHeaders = { authorization: `Bearer ${token}`, 'content-type': 'application/json' }
    await assertDisabled(await app.request(`/api/projects/${projectId}/versions`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        html: '<html><body>editor update</body></html>',
        source: 'editor',
      }),
    }))

    const iterate = await app.request(`/api/projects/${projectId}/versions`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        html: '<html><body>iteration update</body></html>',
        source: 'iterate',
      }),
    })
    expect(iterate.status).toBe(201)
  })
})
