import { beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../src/app'
import { resetDataStoreForTest } from '../src/lib/data-store'

const app = createApp()

beforeEach(() => resetDataStoreForTest())

async function login(email = 'template-user@example.com'): Promise<string> {
  const requested = await app.request('/api/auth/request-code', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email }),
  })
  const debugCode = (await requested.json()).debugCode as string
  const verified = await app.request('/api/auth/verify', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, code: debugCode }),
  })
  return ((await verified.json()).accessToken as string)
}

function authHeaders(token: string): Record<string, string> {
  return { authorization: `Bearer ${token}`, 'content-type': 'application/json' }
}

const brandKitInput = {
  name: '测试品牌',
  description: '用于模板测试',
  primary: '#2563eb',
  secondary: '#0891b2',
  accent: '#f97316',
  background: '#f8fafc',
  surface: '#ffffff',
  text: '#0f172a',
  muted: '#64748b',
  headingFont: 'geometric-sans',
  bodyFont: 'modern-sans',
  radius: 14,
  buttonStyle: 'solid',
  shadow: 'soft',
  isDefault: true,
}

describe('官方模板中心 API', () => {
  it('目录和单个模板预览可公开访问', async () => {
    const list = await app.request('/api/templates')
    expect(list.status).toBe(200)
    const listBody = await list.json()
    expect(listBody.templates.length).toBeGreaterThanOrEqual(10)
    expect(listBody.filters.categories).toContain('商业营销')

    const detail = await app.request(`/api/templates/${listBody.templates[0].slug}`)
    expect(detail.status).toBe(200)
    const detailBody = await detail.json()
    expect(detailBody.previewHtml).toContain('<!doctype html>')
  })

  it('创建项目需要登录', async () => {
    const response = await app.request('/api/templates/aurora-saas/use', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ variables: {} }),
    })
    expect(response.status).toBe(401)
  })

  it('可应用品牌套件并创建不可变项目首版', async () => {
    const token = await login()
    const brandResponse = await app.request('/api/brand-kits', {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(brandKitInput),
    })
    expect(brandResponse.status).toBe(201)
    const brandKit = (await brandResponse.json()).brandKit

    const used = await app.request('/api/templates/aurora-saas/use', {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({
        title: '我的 Aurora 项目',
        brandKitId: brandKit.id,
        variables: {
          brandName: '云图协作',
          headline: '让团队协作真正保持在同一个上下文',
          description: '这是通过官方模板创建的测试项目。',
          primaryCta: '预约演示',
        },
      }),
    })
    expect(used.status).toBe(201)
    const project = (await used.json()).project
    expect(project.templateId).toBe('tpl-aurora-saas')
    expect(project.latestVersion.version).toBe(1)

    const detail = await app.request(`/api/projects/${project.id}`, {
      headers: { authorization: `Bearer ${token}` },
    })
    expect(detail.status).toBe(200)
    const detailBody = await detail.json()
    expect(detailBody.project.templateId).toBe('tpl-aurora-saas')

    const version = await app.request(
      `/api/projects/${project.id}/versions/${project.latestVersion.id}`,
      { headers: { authorization: `Bearer ${token}` } },
    )
    const html = (await version.json()).version.html as string
    expect(html).toContain('云图协作')
    expect(html).toContain('siteforge-brand-kit')
    expect(html).toContain('预约演示')
  })

  it('不能使用其他用户的品牌套件', async () => {
    const ownerToken = await login('owner-template@example.com')
    const otherToken = await login('other-template@example.com')
    const brand = await app.request('/api/brand-kits', {
      method: 'POST',
      headers: authHeaders(ownerToken),
      body: JSON.stringify(brandKitInput),
    })
    const brandKitId = (await brand.json()).brandKit.id

    const response = await app.request('/api/templates/aurora-saas/use', {
      method: 'POST',
      headers: authHeaders(otherToken),
      body: JSON.stringify({ brandKitId, variables: {} }),
    })
    expect(response.status).toBe(404)
  })
})
