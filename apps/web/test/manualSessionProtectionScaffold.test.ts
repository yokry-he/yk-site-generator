import { describe, expect, it } from 'vitest'
import {
  BACKEND_STACK_PROFILES,
  createDefaultManualAccess,
  type ManualEntityDefinition,
} from 'shared'
import { createManualAccessProjectScaffold } from '../src/lib/manualAccessProjectScaffold'

const entities: ManualEntityDefinition[] = [{
  name: 'Task',
  label: '任务',
  pluralLabel: '任务管理',
  route: '/tasks',
  fields: [{ name: 'title', label: '标题', type: 'text', required: true }],
  relations: [],
  list: { pageSize: 20, defaultSortField: 'id', defaultSortDirection: 'desc' },
}]

const stackMarkers: Record<string, string[]> = {
  'hono-drizzle': ['apps/api/src/auth-protection.ts', 'apps/api/drizzle/0003_auth_login_events.sql'],
  'nestjs-prisma': ['apps/api/src/auth-protection.service.ts', 'model AuthLoginEvent'],
  'fastapi-sqlalchemy': ['apps/api/app/auth_protection.py', 'apps/api/migrations/versions/0003_auth_login_events.py'],
  'spring-boot-jpa': ['apps/api/src/main/java/dev/siteforge/api/AuthProtectionService.java', 'apps/api/src/main/resources/db/migration/V3__auth_login_events.sql'],
  'gin-gorm': ['apps/api/internal/auth/protection.go', 'apps/api/migrations/00003_auth_login_events.sql'],
}

describe('persistent session login protection scaffolds', () => {
  it('generates rate limiting, privacy-preserving audit and cleanup for every backend', () => {
    for (const profile of BACKEND_STACK_PROFILES) {
      const access = createDefaultManualAccess(entities)
      access.persistentSessions = true
      const scaffold = createManualAccessProjectScaffold({
        name: `Protected ${profile.shortName}`,
        backendStack: profile.id,
        database: profile.recommendedDatabase,
        includeDocker: false,
        includeGithubActions: false,
        entities,
        access,
      })
      const byPath = new Map(scaffold.files.map((file) => [file.path, file.content]))
      const combined = scaffold.files.map((file) => file.path + '\n' + file.content).join('\n')
      for (const marker of stackMarkers[profile.id]) expect(combined).toContain(marker)
      expect(byPath.has('AUTH_PROTECTION.md')).toBe(true)
      expect(byPath.get('.env.example')).toContain('AUTH_AUDIT_HASH_KEY=')
      expect(byPath.get('.env.example')).toContain('AUTH_MAX_LOGIN_ATTEMPTS=5')
      expect(byPath.get('openapi.yaml')).toContain('/api/auth/maintenance/cleanup:')
      expect(byPath.get('openapi.yaml')).toContain('LOGIN_RATE_LIMITED')
      expect(combined).toContain('auth_login_events')
      expect(combined).toContain('principalHash')
      expect(combined).toContain('networkHash')
      expect(combined).not.toContain('passwordPlaintext')
      const policy = JSON.parse(byPath.get('siteforge.session.json')!)
      expect(policy.protection).toMatchObject({
        rateLimit: { windowSeconds: 900, maxAttempts: 5, lockoutSeconds: 900 },
        audit: { storage: 'auth_login_events', retentionDays: 30 },
        cleanup: { endpoint: 'POST /api/auth/maintenance/cleanup', sessionRetentionDays: 7 },
      })
    }
  })

  it('does not add runtime protection to schema-only output', () => {
    const access = createDefaultManualAccess(entities)
    access.enabled = false
    access.persistentSessions = true
    const scaffold = createManualAccessProjectScaffold({
      name: 'Schema only',
      backendStack: 'hono-drizzle',
      database: 'sqlite',
      includeDocker: false,
      includeGithubActions: false,
      entities,
      access,
    })
    const paths = new Set(scaffold.files.map((file) => file.path))
    expect(paths).not.toContain('AUTH_PROTECTION.md')
    expect(paths).not.toContain('apps/api/src/auth-protection.ts')
    expect(scaffold.files.find((file) => file.path === '.env.example')!.content).not.toContain('AUTH_AUDIT_HASH_KEY=')
  })
})
