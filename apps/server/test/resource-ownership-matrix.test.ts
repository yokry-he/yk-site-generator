import { beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../src/app'
import { resetDataStoreForTest } from '../src/lib/data-store'

const app = createApp()
const html = '<!doctype html><html><head><title>Owner site</title></head><body><main><h1>Private owner content</h1></main></body></html>'
const safePng = `data:image/png;base64,${Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
]).toString('base64')}`
const kitInput = {
  name: 'Owner brand', description: '', primary: '#2563eb', secondary: '#0891b2', accent: '#7c3aed',
  background: '#f8fafc', surface: '#ffffff', text: '#0f172a', muted: '#64748b',
  headingFont: 'geometric-sans', bodyFont: 'modern-sans', radius: 14, buttonStyle: 'solid', shadow: 'soft', isDefault: false,
}

beforeEach(() => resetDataStoreForTest())

async function login(email: string): Promise<string> {
  const request = await app.request('/api/auth/request-code', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email }),
  })
  const code = (await request.json()).debugCode
  const verified = await app.request('/api/auth/verify', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, code }),
  })
  return (await verified.json()).accessToken
}

function headers(token: string): Record<string, string> {
  return { authorization: `Bearer ${token}`, 'content-type': 'application/json' }
}

async function expectNotFound(response: Response): Promise<void> {
  expect(response.status).toBe(404)
  const body = await response.json() as { error?: { code?: string } }
  expect(body.error?.code).toBeTruthy()
}

describe('跨账号资源所有权矩阵', () => {
  it('用户 B 无法读取、关联、修改、复制、发布或删除用户 A 的资源', async () => {
    const ownerToken = await login('matrix-owner@example.com')
    const strangerToken = await login('matrix-stranger@example.com')

    const kitCreated = await app.request('/api/brand-kits', {
      method: 'POST', headers: headers(ownerToken), body: JSON.stringify({ ...kitInput, logoDataUrl: safePng }),
    })
    expect(kitCreated.status).toBe(201)
    const brandKit = (await kitCreated.json()).brandKit

    const assetCreated = await app.request('/api/brand-assets', {
      method: 'POST', headers: headers(ownerToken),
      body: JSON.stringify({ brandKitId: brandKit.id, kind: 'logo', name: 'Owner logo', dataUrl: safePng, tags: [] }),
    })
    expect(assetCreated.status).toBe(201)
    const brandAsset = (await assetCreated.json()).asset

    const projectCreated = await app.request('/api/projects', {
      method: 'POST', headers: headers(ownerToken),
      body: JSON.stringify({ title: 'Owner project', siteType: 'saas', requirement: 'private', html, source: 'generate', brandKitId: brandKit.id }),
    })
    expect(projectCreated.status).toBe(201)
    const project = (await projectCreated.json()).project
    const versionId = project.latestVersion.id as string

    const publicationCreated = await app.request('/api/publications', {
      method: 'POST', headers: headers(ownerToken),
      body: JSON.stringify({ title: 'Owner publication', projectId: project.id, versionId }),
    })
    expect(publicationCreated.status).toBe(201)
    const publication = (await publicationCreated.json()).publication

    const attempts: Array<Response | Promise<Response>> = [
      app.request(`/api/projects/${project.id}`, { headers: headers(strangerToken) }),
      app.request(`/api/projects/${project.id}`, { method: 'PATCH', headers: headers(strangerToken), body: JSON.stringify({ title: 'Hijacked' }) }),
      app.request(`/api/projects/${project.id}`, { method: 'DELETE', headers: headers(strangerToken) }),
      app.request(`/api/projects/${project.id}/duplicate`, { method: 'POST', headers: headers(strangerToken) }),
      app.request(`/api/projects/${project.id}/versions/${versionId}`, { headers: headers(strangerToken) }),
      app.request(`/api/projects/${project.id}/versions/${versionId}`, { method: 'PATCH', headers: headers(strangerToken), body: JSON.stringify({ name: 'Hijacked version' }) }),
      app.request(`/api/projects/${project.id}/versions`, { method: 'POST', headers: headers(strangerToken), body: JSON.stringify({ html, source: 'editor', parentVersionId: versionId }) }),
      app.request(`/api/projects/${project.id}/rollback`, { method: 'POST', headers: headers(strangerToken), body: JSON.stringify({ versionId }) }),
      app.request('/api/publications', { method: 'POST', headers: headers(strangerToken), body: JSON.stringify({ title: 'Stolen publication', projectId: project.id, versionId }) }),
      app.request(`/api/publications/${publication.id}`, { method: 'PATCH', headers: headers(strangerToken), body: JSON.stringify({ title: 'Hijacked publication' }) }),
      app.request(`/api/publications/${publication.id}/republish`, { method: 'POST', headers: headers(strangerToken), body: JSON.stringify({ html }) }),
      app.request(`/api/publications/${publication.id}`, { method: 'DELETE', headers: headers(strangerToken) }),
      app.request(`/api/brand-kits/${brandKit.id}`, { headers: headers(strangerToken) }),
      app.request(`/api/brand-kits/${brandKit.id}`, { method: 'PATCH', headers: headers(strangerToken), body: JSON.stringify({ name: 'Hijacked brand' }) }),
      app.request(`/api/brand-kits/${brandKit.id}/default`, { method: 'POST', headers: headers(strangerToken) }),
      app.request(`/api/brand-kits/${brandKit.id}`, { method: 'DELETE', headers: headers(strangerToken) }),
      app.request(`/api/brand-assets/${brandAsset.id}`, { method: 'PATCH', headers: headers(strangerToken), body: JSON.stringify({ name: 'Hijacked asset' }) }),
      app.request(`/api/brand-assets/${brandAsset.id}`, { method: 'DELETE', headers: headers(strangerToken) }),
      app.request('/api/projects', { method: 'POST', headers: headers(strangerToken), body: JSON.stringify({ title: 'Cross-linked project', siteType: 'saas', requirement: '', brandKitId: brandKit.id }) }),
      app.request('/api/brand-assets', { method: 'POST', headers: headers(strangerToken), body: JSON.stringify({ brandKitId: brandKit.id, kind: 'logo', name: 'Cross-linked asset', dataUrl: safePng, tags: [] }) }),
    ]

    for (const attempt of attempts) await expectNotFound(await attempt)

    const strangerProjects = await app.request('/api/projects?status=all', { headers: headers(strangerToken) })
    expect((await strangerProjects.json()).projects).toEqual([])
    const strangerPublications = await app.request('/api/publications', { headers: headers(strangerToken) })
    expect((await strangerPublications.json()).publications).toEqual([])
    const strangerKits = await app.request('/api/brand-kits', { headers: headers(strangerToken) })
    expect((await strangerKits.json()).brandKits).toEqual([])
    const strangerAssets = await app.request('/api/brand-assets', { headers: headers(strangerToken) })
    expect((await strangerAssets.json()).assets).toEqual([])

    const ownerProject = await app.request(`/api/projects/${project.id}`, { headers: headers(ownerToken) })
    expect(ownerProject.status).toBe(200)
    expect((await ownerProject.json()).project).toMatchObject({ title: 'Owner project', brandKitId: brandKit.id })
    const ownerPublications = await app.request('/api/publications', { headers: headers(ownerToken) })
    expect((await ownerPublications.json()).publications).toHaveLength(1)
    const ownerKit = await app.request(`/api/brand-kits/${brandKit.id}`, { headers: headers(ownerToken) })
    expect((await ownerKit.json()).brandKit.name).toBe('Owner brand')
    const ownerAssets = await app.request('/api/brand-assets', { headers: headers(ownerToken) })
    expect((await ownerAssets.json()).assets).toHaveLength(1)
  })
})
