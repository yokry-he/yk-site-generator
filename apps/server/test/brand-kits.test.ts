import { beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../src/app'
import { resetDataStoreForTest } from '../src/lib/data-store'

const app = createApp()

beforeEach(() => resetDataStoreForTest())

async function login(email = 'brand@example.com') {
  const requested = await app.request('/api/auth/request-code', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email }),
  })
  const debugCode = (await requested.json()).debugCode
  const verified = await app.request('/api/auth/verify', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, code: debugCode }),
  })
  return (await verified.json()).accessToken as string
}

function headers(token: string): Record<string, string> {
  return { authorization: `Bearer ${token}`, 'content-type': 'application/json' }
}

const kit = {
  name: 'Acme 品牌',
  description: '企业品牌套件',
  primary: '#2563eb',
  secondary: '#0891b2',
  accent: '#7c3aed',
  background: '#f8fafc',
  surface: '#ffffff',
  text: '#0f172a',
  muted: '#64748b',
  headingFont: 'geometric-sans',
  bodyFont: 'modern-sans',
  radius: 14,
  buttonStyle: 'solid',
  shadow: 'soft',
  isDefault: false,
}

describe('品牌套件 API', () => {
  it('首个套件自动成为默认,支持更新、切换默认和删除', async () => {
    const token = await login()
    const firstResponse = await app.request('/api/brand-kits', {
      method: 'POST',
      headers: headers(token),
      body: JSON.stringify(kit),
    })
    expect(firstResponse.status).toBe(201)
    const first = (await firstResponse.json()).brandKit
    expect(first.isDefault).toBe(true)

    const secondResponse = await app.request('/api/brand-kits', {
      method: 'POST',
      headers: headers(token),
      body: JSON.stringify({ ...kit, name: '第二套', primary: '#047857' }),
    })
    const second = (await secondResponse.json()).brandKit
    expect(second.isDefault).toBe(false)

    const makeDefault = await app.request(`/api/brand-kits/${second.id}/default`, {
      method: 'POST',
      headers: headers(token),
    })
    expect(makeDefault.status).toBe(200)
    expect((await makeDefault.json()).brandKit.isDefault).toBe(true)

    const updated = await app.request(`/api/brand-kits/${second.id}`, {
      method: 'PATCH',
      headers: headers(token),
      body: JSON.stringify({ name: '第二套已更新', radius: 20 }),
    })
    expect(updated.status).toBe(200)
    expect((await updated.json()).brandKit).toMatchObject({ name: '第二套已更新', radius: 20 })

    const listResponse = await app.request('/api/brand-kits', {
      headers: { authorization: `Bearer ${token}` },
    })
    const list = (await listResponse.json()).brandKits
    expect(list).toHaveLength(2)
    expect(list[0].id).toBe(second.id)

    const deleted = await app.request(`/api/brand-kits/${second.id}`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(deleted.status).toBe(200)

    const afterDelete = await app.request('/api/brand-kits', {
      headers: { authorization: `Bearer ${token}` },
    })
    const remaining = (await afterDelete.json()).brandKits
    expect(remaining).toHaveLength(1)
    expect(remaining[0]).toMatchObject({ id: first.id, isDefault: true })
  })

  it('隔离不同用户的品牌套件并拒绝非法颜色', async () => {
    const firstToken = await login('first@example.com')
    const secondToken = await login('second@example.com')

    const invalid = await app.request('/api/brand-kits', {
      method: 'POST',
      headers: headers(firstToken),
      body: JSON.stringify({ ...kit, primary: 'blue' }),
    })
    expect(invalid.status).toBe(400)

    await app.request('/api/brand-kits', {
      method: 'POST',
      headers: headers(firstToken),
      body: JSON.stringify(kit),
    })
    const otherList = await app.request('/api/brand-kits', {
      headers: { authorization: `Bearer ${secondToken}` },
    })
    expect((await otherList.json()).brandKits).toEqual([])
  })
})
