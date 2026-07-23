import { beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../src/app'
import { createAccessToken } from '../src/lib/auth'
import { resetDataStoreForTest } from '../src/lib/data-store'

const app = createApp()
const userId = '00000000-0000-4000-8000-000000000001'
const sessionId = '00000000-0000-4000-8000-000000000002'

beforeEach(() => {
  resetDataStoreForTest({
    users: [{
      id: userId,
      email: 'admin@example.com',
      role: 'admin',
      status: 'active',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }],
    sessions: [{
      id: sessionId,
      userId,
      refreshTokenHash: 'test',
      createdAt: '2026-01-01T00:00:00.000Z',
      lastUsedAt: '2026-01-01T00:00:00.000Z',
      expiresAt: '2099-01-01T00:00:00.000Z',
    }],
  })
})

describe('管理员存储健康状态', () => {
  it('精确健康路由返回当前真实数据驱动', async () => {
    const { token } = createAccessToken({ userId, sessionId, email: 'admin@example.com' })
    const response = await app.request('/api/admin/health', {
      headers: { authorization: `Bearer ${token}` },
    })
    expect(response.status).toBe(200)
    const body = await response.json() as {
      health: { components: Array<{ id: string; status: string; detail: string }> }
    }
    const data = body.health.components.find((item) => item.id === 'data')
    const mysql = body.health.components.find((item) => item.id === 'mysql')
    expect(data?.status).toBe('operational')
    expect(data?.detail).toContain('MEMORY')
    expect(mysql?.status).toBe('not_configured')
  })
})
