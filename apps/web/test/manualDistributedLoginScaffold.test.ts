import { describe, expect, it } from 'vitest'
import { createDefaultManualAccess, DEFAULT_MANUAL_ENTITIES } from 'shared'
import { applyManualDistributedLogin } from '../src/lib/manualDistributedLoginScaffold'

describe('distributed login limit scaffold', () => {
  it('generates a shared store for all stacks', () => {
    const access = createDefaultManualAccess(DEFAULT_MANUAL_ENTITIES)
    access.persistentSessions = true
    for (const stack of ['hono-drizzle','nestjs-prisma','fastapi-sqlalchemy','spring-boot-jpa','gin-gorm'] as const) {
      const files = applyManualDistributedLogin([
        { path: '.env.example', content: '' },
        { path: 'apps/api/prisma/schema.prisma', content: '' },
        { path: 'apps/api/drizzle/0002_auth_identity_sessions.sql', content: 'AUTOINCREMENT' },
      ], stack, access)
      expect(files.some((file) => file.content.includes('auth_login_limits'))).toBe(true)
      expect(files.find((file) => file.path === '.env.example')!.content).toContain('AUTH_LOGIN_LIMIT_DRIVER=database')
      expect(files.find((file) => file.path === 'siteforge.login-limit.json')).toBeTruthy()
    }
  })
})
