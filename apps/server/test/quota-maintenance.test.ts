import { beforeEach, describe, expect, it } from 'vitest'
import { resetDataStoreForTest, readData } from '../src/lib/data-store'
import { runMaintenance } from '../src/lib/maintenance'
import {
  QuotaExceededError,
  getQuotaSummary,
  refundUsage,
  reserveGenerationUsage,
} from '../src/lib/quota'
import { resetShareStoreForTest } from '../src/lib/share-store'

beforeEach(() => {
  resetDataStoreForTest()
  resetShareStoreForTest()
})

describe('额度并发与维护任务', () => {
  it('并发预占不会突破月度上限,退回后可再次预占', async () => {
    const userId = 'quota-user'
    const reservations = await Promise.all(
      Array.from({ length: 100 }, (_, index) =>
        reserveGenerationUsage({
          userId,
          action: index % 2 ? 'iterate' : 'generate',
          siteType: 'personal',
          model: 'test-model',
        }),
      ),
    )
    expect(new Set(reservations.map((item) => item.id)).size).toBe(100)
    await expect(
      reserveGenerationUsage({ userId, action: 'generate' }),
    ).rejects.toBeInstanceOf(QuotaExceededError)

    await refundUsage(reservations[0].id, userId)
    await expect(
      reserveGenerationUsage({ userId, action: 'generate' }),
    ).resolves.toMatchObject({ userId, units: 1 })
    const summary = await getQuotaSummary(userId)
    expect(summary.used).toBe(100)
    expect(summary.remaining).toBe(0)
  })

  it('清理过期验证码、过期会话和长期撤销会话', async () => {
    const now = Date.now()
    resetDataStoreForTest({
      verificationCodes: [
        {
          id: 'expired-code',
          email: 'expired@example.com',
          codeHash: 'hash',
          attempts: 0,
          createdAt: new Date(now - 20_000).toISOString(),
          expiresAt: new Date(now - 1_000).toISOString(),
        },
        {
          id: 'valid-code',
          email: 'valid@example.com',
          codeHash: 'hash',
          attempts: 0,
          createdAt: new Date(now).toISOString(),
          expiresAt: new Date(now + 60_000).toISOString(),
        },
      ],
      sessions: [
        {
          id: 'expired-session',
          userId: 'u1',
          refreshTokenHash: 'a',
          createdAt: new Date(now - 100_000).toISOString(),
          lastUsedAt: new Date(now - 100_000).toISOString(),
          expiresAt: new Date(now - 1_000).toISOString(),
        },
        {
          id: 'old-revoked-session',
          userId: 'u1',
          refreshTokenHash: 'b',
          createdAt: new Date(now - 40 * 86_400_000).toISOString(),
          lastUsedAt: new Date(now - 40 * 86_400_000).toISOString(),
          expiresAt: new Date(now + 86_400_000).toISOString(),
          revokedAt: new Date(now - 31 * 86_400_000).toISOString(),
        },
        {
          id: 'active-session',
          userId: 'u1',
          refreshTokenHash: 'c',
          createdAt: new Date(now).toISOString(),
          lastUsedAt: new Date(now).toISOString(),
          expiresAt: new Date(now + 86_400_000).toISOString(),
        },
      ],
    })

    const result = await runMaintenance(now)
    expect(result).toMatchObject({ verificationCodes: 1, sessions: 2 })
    const data = await readData()
    expect(data.verificationCodes.map((item) => item.id)).toEqual(['valid-code'])
    expect(data.sessions.map((item) => item.id)).toEqual(['active-session'])
  })
})
