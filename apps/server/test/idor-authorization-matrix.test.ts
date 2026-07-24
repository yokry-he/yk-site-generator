import { beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../src/app'
import { readData, resetDataStoreForTest } from '../src/lib/data-store'

const app = createApp()
const now = '2026-07-24T00:00:00.000Z'
const ownerId = '00000000-0000-4000-8000-000000000701'
const attackerId = '00000000-0000-4000-8000-000000000702'
const projectId = '00000000-0000-4000-8000-000000000710'
const versionId = '00000000-0000-4000-8000-000000000711'
const publicationId = '00000000-0000-4000-8000-000000000712'
const brandKitId = '00000000-0000-4000-8000-000000000713'
const brandAssetId = '00000000-0000-4000-8000-000000000714'
const html = '<!doctype html><html><body><main><h1>Owner only</h1></main></body></html>'
const pngDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2l9sAAAAASUVORK5CYII='

beforeEach(() => {
  resetDataStoreForTest({
    users: [
      { id: ownerId, email: 'idor-owner@example.com', role: 'user', status: 'active', createdAt: now, updatedAt: now },
      { id: attackerId, email: 'idor-attacker@example.com', role: 'user', status: 'active', createdAt: now, updatedAt: now },
    ],
    projects: [
      { id: projectId, userId: ownerId, title: 'Owner project', siteType: 'saas', requirement: 'private', status: 'active', starred: false, brandKitId, createdAt: now, updatedAt: now },
    ],
    projectVersions: [
      { id: versionId, projectId, userId: ownerId, version: 1, html, source: 'generate', name: 'Owner version', starred: true, changeSummary: ['Initial'], createdAt: now },
    ],
    publications: [
      { id: publicationId, userId: ownerId, projectId, versionId, slug: 'owner-private-site', title: 'Owner publication', html, status: 'published', createdAt: now, updatedAt: now, publishedAt: now },
    ],
    brandKits: [
      { id: brandKitId, userId: ownerId, name: 'Owner brand', description: 'private', isDefault: true, primary: '#7c3aed', secondary: '#22d3ee', accent: '#f472b6', background: '#ffffff', surface: '#f8fafc', text: '#18181b', muted: '#64748b', headingFont: 'modern-sans', bodyFont: 'modern-sans', radius: 16, buttonStyle: 'solid', shadow: 'soft', createdAt: now, updatedAt: now },
    ],
    brandAssets: [
      { id: brandAssetId, userId: ownerId, brandKitId, kind: 'logo', name: 'Owner logo', dataUrl: pngDataUrl, alt: 'Owner logo', tags: ['private'], createdAt: now, updatedAt: now },
    ],
  })
})

async function login(email: string): Promise<string> {
  const request = await app.request('/api/auth/request-code', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email }),
  })
  expect(request.status).toBe(202)
  const code = (await request.json()).debugCode as string
  const response = await app.request('/api/auth/verify', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, code }),
  })
  expect(response.status).toBe(200)
  return (await response.json()).accessToken as string
}

function headers(token: string): Record<string, string> {
  return { authorization: `Bearer ${token}`, 'content-type': 'application/json' }
}

async function expectNotFound(response: Response, expectedCode: string): Promise<void> {
  expect(response.status).toBe(404)
  const body = await response.json() as { error?: { code?: string } }
  expect(body.error?.code).toBe(expectedCode)
}

describe('cross-tenant IDOR authorization matrix', () => {
  it('does not expose owner resources in attacker collection endpoints', async () => {
    const token = await login('idor-attacker@example.com')
    const [projects, publications, kits, assets] = await Promise.all([
      app.request('/api/projects?status=all', { headers: headers(token) }),
      app.request('/api/publications', { headers: headers(token) }),
      app.request('/api/brand-kits', { headers: headers(token) }),
      app.request('/api/brand-assets', { headers: headers(token) }),
    ])

    expect((await projects.json()).projects).toEqual([])
    expect((await publications.json()).publications).toEqual([])
    expect((await kits.json()).brandKits).toEqual([])
    expect((await assets.json()).assets).toEqual([])
  })

  it('blocks project read, update, duplicate and delete across tenants', async () => {
    const token = await login('idor-attacker@example.com')
    await expectNotFound(await app.request(`/api/projects/${projectId}`, { headers: headers(token) }), 'PROJECT_NOT_FOUND')
    await expectNotFound(await app.request(`/api/projects/${projectId}`, { method: 'PATCH', headers: headers(token), body: JSON.stringify({ title: 'Hijacked' }) }), 'PROJECT_NOT_FOUND')
    await expectNotFound(await app.request(`/api/projects/${projectId}/duplicate`, { method: 'POST', headers: headers(token) }), 'PROJECT_NOT_FOUND')
    await expectNotFound(await app.request(`/api/projects/${projectId}`, { method: 'DELETE', headers: headers(token) }), 'PROJECT_NOT_FOUND')

    const data = await readData()
    expect(data.projects.find((item) => item.id === projectId)?.title).toBe('Owner project')
    expect(data.projects).toHaveLength(1)
    expect(data.projectVersions).toHaveLength(1)
  })

  it('blocks version read, metadata update, creation and rollback across tenants', async () => {
    const token = await login('idor-attacker@example.com')
    await expectNotFound(await app.request(`/api/projects/${projectId}/versions/${versionId}`, { headers: headers(token) }), 'PROJECT_NOT_FOUND')
    await expectNotFound(await app.request(`/api/projects/${projectId}/versions/${versionId}`, { method: 'PATCH', headers: headers(token), body: JSON.stringify({ name: 'Hijacked version' }) }), 'VERSION_NOT_FOUND')
    await expectNotFound(await app.request(`/api/projects/${projectId}/versions`, { method: 'POST', headers: headers(token), body: JSON.stringify({ html, source: 'import' }) }), 'PROJECT_NOT_FOUND')
    await expectNotFound(await app.request(`/api/projects/${projectId}/rollback`, { method: 'POST', headers: headers(token), body: JSON.stringify({ versionId }) }), 'VERSION_NOT_FOUND')

    const data = await readData()
    expect(data.projectVersions).toHaveLength(1)
    expect(data.projectVersions[0]?.name).toBe('Owner version')
  })

  it('blocks publication mutation and foreign-version publication across tenants', async () => {
    const token = await login('idor-attacker@example.com')
    await expectNotFound(await app.request(`/api/publications/${publicationId}`, { method: 'PATCH', headers: headers(token), body: JSON.stringify({ title: 'Hijacked publication' }) }), 'PUBLICATION_NOT_FOUND')
    await expectNotFound(await app.request(`/api/publications/${publicationId}/republish`, { method: 'POST', headers: headers(token), body: JSON.stringify({ html }) }), 'PUBLICATION_NOT_FOUND')
    await expectNotFound(await app.request(`/api/publications/${publicationId}`, { method: 'DELETE', headers: headers(token) }), 'PUBLICATION_NOT_FOUND')
    await expectNotFound(await app.request('/api/publications', { method: 'POST', headers: headers(token), body: JSON.stringify({ title: 'Stolen version', versionId }) }), 'VERSION_NOT_FOUND')

    const data = await readData()
    expect(data.publications).toHaveLength(1)
    expect(data.publications[0]?.title).toBe('Owner publication')
  })

  it('blocks brand kit read, update, default change and delete across tenants', async () => {
    const token = await login('idor-attacker@example.com')
    await expectNotFound(await app.request(`/api/brand-kits/${brandKitId}`, { headers: headers(token) }), 'BRAND_KIT_NOT_FOUND')
    await expectNotFound(await app.request(`/api/brand-kits/${brandKitId}`, { method: 'PATCH', headers: headers(token), body: JSON.stringify({ name: 'Hijacked brand' }) }), 'BRAND_KIT_NOT_FOUND')
    await expectNotFound(await app.request(`/api/brand-kits/${brandKitId}/default`, { method: 'POST', headers: headers(token) }), 'BRAND_KIT_NOT_FOUND')
    await expectNotFound(await app.request(`/api/brand-kits/${brandKitId}`, { method: 'DELETE', headers: headers(token) }), 'BRAND_KIT_NOT_FOUND')

    const data = await readData()
    expect(data.brandKits).toHaveLength(1)
    expect(data.brandKits[0]?.name).toBe('Owner brand')
    expect(data.brandKits[0]?.isDefault).toBe(true)
  })

  it('blocks brand asset update and delete across tenants', async () => {
    const token = await login('idor-attacker@example.com')
    await expectNotFound(await app.request(`/api/brand-assets/${brandAssetId}`, { method: 'PATCH', headers: headers(token), body: JSON.stringify({ name: 'Hijacked asset' }) }), 'BRAND_ASSET_NOT_FOUND')
    await expectNotFound(await app.request(`/api/brand-assets/${brandAssetId}`, { method: 'DELETE', headers: headers(token) }), 'BRAND_ASSET_NOT_FOUND')

    const data = await readData()
    expect(data.brandAssets).toHaveLength(1)
    expect(data.brandAssets[0]?.name).toBe('Owner logo')
  })

  it('rejects attaching another tenant brand kit to a new or existing project', async () => {
    const token = await login('idor-attacker@example.com')
    await expectNotFound(await app.request('/api/projects', { method: 'POST', headers: headers(token), body: JSON.stringify({ title: 'Attacker project', siteType: 'saas', requirement: '', brandKitId }) }), 'BRAND_KIT_NOT_FOUND')

    const created = await app.request('/api/projects', { method: 'POST', headers: headers(token), body: JSON.stringify({ title: 'Attacker project', siteType: 'saas', requirement: '' }) })
    expect(created.status).toBe(201)
    const attackerProjectId = (await created.json()).project.id as string
    await expectNotFound(await app.request(`/api/projects/${attackerProjectId}`, { method: 'PATCH', headers: headers(token), body: JSON.stringify({ brandKitId }) }), 'BRAND_KIT_NOT_FOUND')

    const data = await readData()
    expect(data.projects.find((item) => item.id === attackerProjectId)?.brandKitId).toBeUndefined()
  })
})
