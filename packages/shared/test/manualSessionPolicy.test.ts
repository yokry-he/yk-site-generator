import { describe, expect, it } from 'vitest'
import {
  DEFAULT_MANUAL_ACTIVE_SESSIONS,
  DEFAULT_MANUAL_SESSION_TTL_SECONDS,
  cloneManualAccess,
  createDefaultManualAccess,
  normalizeManualAccess,
  normalizeManualSession,
} from '../src/manualAccess'
import { normalizeManualEntities } from '../src/manualProject'

const entities = normalizeManualEntities([{
  name: 'Task',
  label: '任务',
  pluralLabel: '任务管理',
  route: '/tasks',
  fields: [{ name: 'title', label: '标题', type: 'text', required: true }],
}])

describe('manual persistent session policy', () => {
  it('keeps persistent sessions opt-in with secure defaults', () => {
    const access = createDefaultManualAccess(entities)
    expect(access.persistentSessions).toBe(false)
    expect(access.session).toEqual({
      ttlSeconds: DEFAULT_MANUAL_SESSION_TTL_SECONDS,
      maxActiveSessions: DEFAULT_MANUAL_ACTIVE_SESSIONS,
    })
  })

  it('normalizes and clones session settings without sharing state', () => {
    const access = normalizeManualAccess({
      ...createDefaultManualAccess(entities),
      persistentSessions: true,
      session: { ttlSeconds: 43_200, maxActiveSessions: 3 },
    }, entities)
    const cloned = cloneManualAccess(access)
    cloned.session!.ttlSeconds = 900
    expect(access.persistentSessions).toBe(true)
    expect(access.session).toEqual({ ttlSeconds: 43_200, maxActiveSessions: 3 })
  })

  it('rejects unsafe or unbounded session settings', () => {
    expect(() => normalizeManualSession({ ttlSeconds: 899, maxActiveSessions: 5 })).toThrow(/Session 有效期/)
    expect(() => normalizeManualSession({ ttlSeconds: 3_000_000, maxActiveSessions: 5 })).toThrow(/Session 有效期/)
    expect(() => normalizeManualSession({ ttlSeconds: 3_600, maxActiveSessions: 0 })).toThrow(/活动 Session/)
    expect(() => normalizeManualSession({ ttlSeconds: 3_600, maxActiveSessions: 21 })).toThrow(/活动 Session/)
  })
})
