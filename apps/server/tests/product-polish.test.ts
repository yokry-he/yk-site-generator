import { beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../src/app'
import { readData, resetDataStoreForTest } from '../src/lib/data-store'

const app = createApp()
const now = '2026-07-24T00:00:00.000Z'
const userId = '00000000-0000-4000-8000-000000000201'
const otherUserId = '00000000-0000-4000-8000-000000000202'
const projectId = '00000000-0000-4000-8000-000000000210'
const versionId = '00000000-0000-4000-8000-000000000211'

beforeEach(() => {
  resetDataStoreForTest({
    users: [
      { id: userId, email: 'owner@example.com', role: 'user', status: 'active', createdAt: now, updatedAt: now },
      { id: otherUserId, email: 'other@example.com', role: 'user', status: 'active', createdAt: now, updatedAt: now },
    ],
    projects: [{ id: projectId, userId, title: 'Product polish', siteType: 'saas', requirement: 'test', status: 'active', starred: false, createdAt: now, updatedAt: now }],
    projectVersions: [{ id: versionId, projectId, userId, version: 1, html: '<!doctype html><html><body><main><h1>Version one</h1></main></body></html>', source: 'generate', name: 'Initial', starred: true, changeSummary: ['Initial version'], createdAt: now }],
  })
})

async function login(email: string): Promise<string> {
  const request = await app.request('/api/auth/request-code', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email }) })
  expect(request.status).toBe(202)
  const code = (await request.json()).debugCode as string
  const response = await app.request('/api/auth/verify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, code }) })
  expect(response.status).toBe(200)
  return (await response.json()).accessToken as string
}

function headers(token: string): Record<string, string> {
  return { authorization: `Bearer ${token}`, 'content-type': 'application/json' }
}

describe('功能补全与细节优化', () => {
  it('项目支持收藏、归档、回收站、恢复和完整副本', async () => {
    const token = await login('owner@example.com')
    const starred = await app.request(`/api/projects/${projectId}`, { method: 'PATCH', headers: headers(token), body: JSON.stringify({ starred: true, status: 'archived' }) })
    expect(starred.status).toBe(200)
    expect((await starred.json()).project).toMatchObject({ starred: true, status: 'archived' })

    const archived = await app.request('/api/projects?status=archived', { headers: headers(token) })
    expect(archived.status).toBe(200)
    expect((await archived.json()).projects).toHaveLength(1)

    const duplicated = await app.request(`/api/projects/${projectId}/duplicate`, { method: 'POST', headers: headers(token) })
    expect(duplicated.status).toBe(201)
    const copy = (await duplicated.json()).project
    expect(copy).toMatchObject({ title: 'Product polish 副本', status: 'active', duplicatedFromId: projectId })
    expect(copy.latestVersion.version).toBe(1)

    const trashed = await app.request(`/api/projects/${projectId}`, { method: 'PATCH', headers: headers(token), body: JSON.stringify({ status: 'trashed' }) })
    expect(trashed.status).toBe(200)
    const restored = await app.request(`/api/projects/${projectId}`, { method: 'PATCH', headers: headers(token), body: JSON.stringify({ status: 'active' }) })
    expect((await restored.json()).project.status).toBe('active')
  })

  it('版本支持名称、备注、收藏、父版本和变更摘要', async () => {
    const token = await login('owner@example.com')
    const created = await app.request(`/api/projects/${projectId}/versions`, {
      method: 'POST', headers: headers(token),
      body: JSON.stringify({
        html: '<!doctype html><html><body><main><h1>Version two</h1><section><p>More content for the second version.</p></section></main></body></html>',
        source: 'editor', name: 'Homepage polish', note: 'Improved hierarchy', parentVersionId: versionId,
      }),
    })
    expect(created.status).toBe(201)
    const version = (await created.json()).version
    expect(version).toMatchObject({ version: 2, name: 'Homepage polish', note: 'Improved hierarchy', parentVersionId: versionId, starred: false })
    expect(version.changeSummary.length).toBeGreaterThan(0)

    const updated = await app.request(`/api/projects/${projectId}/versions/${version.id}`, { method: 'PATCH', headers: headers(token), body: JSON.stringify({ name: 'Approved homepage', starred: true }) })
    expect(updated.status).toBe(200)
    expect((await updated.json()).version).toMatchObject({ name: 'Approved homepage', starred: true })
  })

  it('品牌资源按用户隔离并支持更新和删除', async () => {
    const ownerToken = await login('owner@example.com')
    const otherToken = await login('other@example.com')
    const pngBytes = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])
    const dataUrl = `data:image/png;base64,${Buffer.from(pngBytes).toString('base64')}`
    const created = await app.request('/api/brand-assets', { method: 'POST', headers: headers(ownerToken), body: JSON.stringify({ kind: 'logo', name: 'Main logo', dataUrl, alt: 'Company logo', tags: ['brand'] }) })
    expect(created.status).toBe(201)
    const asset = (await created.json()).asset

    const ownerList = await app.request('/api/brand-assets', { headers: headers(ownerToken) })
    expect((await ownerList.json()).assets).toHaveLength(1)
    const otherList = await app.request('/api/brand-assets', { headers: headers(otherToken) })
    expect((await otherList.json()).assets).toHaveLength(0)

    const forbiddenUpdate = await app.request(`/api/brand-assets/${asset.id}`, { method: 'PATCH', headers: headers(otherToken), body: JSON.stringify({ name: 'Stolen' }) })
    expect(forbiddenUpdate.status).toBe(404)
    const updated = await app.request(`/api/brand-assets/${asset.id}`, { method: 'PATCH', headers: headers(ownerToken), body: JSON.stringify({ name: 'Primary logo', tags: ['brand', 'dark'] }) })
    expect((await updated.json()).asset).toMatchObject({ name: 'Primary logo', tags: ['brand', 'dark'] })
    const removed = await app.request(`/api/brand-assets/${asset.id}`, { method: 'DELETE', headers: headers(ownerToken) })
    expect(removed.status).toBe(200)
  })

  it('模板目录扩展到 24 套并支持云端收藏', async () => {
    const catalog = await app.request('/api/templates', { headers: { 'x-anonymous-id': 'template-test-user' } })
    expect(catalog.status).toBe(200)
    const rows = (await catalog.json()).templates as Array<{ id: string }>
    expect(rows.length).toBeGreaterThanOrEqual(24)
    expect(rows.some((item) => item.id === 'tpl-vital-clinic')).toBe(true)

    const token = await login('owner@example.com')
    const favorite = await app.request('/api/templates/tpl-vital-clinic/favorite', { method: 'PUT', headers: headers(token) })
    expect(favorite.status).toBe(200)
    const favorites = await app.request('/api/templates/favorites', { headers: headers(token) })
    expect((await favorites.json()).favoriteTemplateIds).toContain('tpl-vital-clinic')
    await app.request('/api/templates/tpl-vital-clinic/favorite', { method: 'DELETE', headers: headers(token) })
    const data = await readData()
    expect(data.templateFavorites).toHaveLength(0)
  })
})
