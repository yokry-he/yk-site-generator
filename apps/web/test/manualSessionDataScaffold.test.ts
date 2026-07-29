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

const expectedStackPaths: Record<string, string> = {
  'hono-drizzle': 'apps/api/drizzle/0002_auth_identity_sessions.sql',
  'nestjs-prisma': 'apps/api/prisma/schema.prisma',
  'fastapi-sqlalchemy': 'apps/api/migrations/versions/0002_auth_identity_sessions.py',
  'spring-boot-jpa': 'apps/api/src/main/resources/db/migration/V2__auth_identity_sessions.sql',
  'gin-gorm': 'apps/api/migrations/00002_auth_identity_sessions.sql',
}

describe('persistent identity and session data scaffolds', () => {
  it('generates user/session schemas and security contracts for every backend', () => {
    for (const profile of BACKEND_STACK_PROFILES) {
      const access = createDefaultManualAccess(entities)
      access.persistentSessions = true
      access.session = { ttlSeconds: 43_200, maxActiveSessions: 3 }
      const scaffold = createManualAccessProjectScaffold({
        name: `Session ${profile.shortName}`,
        backendStack: profile.id,
        database: profile.recommendedDatabase,
        includeDocker: false,
        includeGithubActions: false,
        entities,
        access,
      })
      const paths = new Set(scaffold.files.map((file) => file.path))
      const combined = scaffold.files.map((file) => file.content).join('\n')
      const policy = JSON.parse(scaffold.files.find((file) => file.path === 'siteforge.session.json')!.content)

      expect(paths).toContain(expectedStackPaths[profile.id])
      expect(paths).toContain('siteforge.session.json')
      expect(paths).toContain('SESSION_SECURITY.md')
      expect(combined).toContain('auth_users')
      expect(combined).toContain('auth_sessions')
      expect(combined).toContain('token_hash')
      expect(combined).toContain('password_hash')
      expect(combined).toContain('AUTH_BOOTSTRAP_EMAIL')
      expect(combined).toContain('AUTH_SESSION_TTL_SECONDS=43200')
      expect(combined).toContain('AUTH_MAX_ACTIVE_SESSIONS=3')
      expect(policy).toMatchObject({
        schemaVersion: 1,
        status: 'schema-ready',
        runtime: 'not-wired',
        password: { algorithm: 'PBKDF2-HMAC-SHA256', iterations: 600000 },
        session: { tokenBytes: 32, ttlSeconds: 43200, maxActiveSessions: 3 },
      })
    }
  })

  it('does not add persistent tables unless explicitly enabled', () => {
    const scaffold = createManualAccessProjectScaffold({
      name: 'Static Bearer Only',
      backendStack: 'hono-drizzle',
      database: 'sqlite',
      includeDocker: false,
      includeGithubActions: false,
      entities,
      access: createDefaultManualAccess(entities),
    })
    expect(scaffold.files.some((file) => file.path === 'siteforge.session.json')).toBe(false)
    expect(scaffold.files.some((file) => file.path === 'SESSION_SECURITY.md')).toBe(false)
    expect(scaffold.files.find((file) => file.path === 'apps/api/src/schema.ts')!.content).not.toContain('authSessionTable')
  })
})
