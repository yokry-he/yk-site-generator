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

const runtimeMarkers: Record<string, string[]> = {
  'hono-drizzle': ['apps/api/src/auth.ts', 'registerSessionAuthRoutes', 'pbkdf2Sync', 'authSessionTable'],
  'nestjs-prisma': ['apps/api/src/auth.service.ts', 'AuthService', 'pbkdf2Sync', 'prisma.authSession'],
  'fastapi-sqlalchemy': ['apps/api/app/session_auth.py', 'pbkdf2_hmac', '@router.post("/login")', 'AuthSession'],
  'spring-boot-jpa': ['apps/api/src/main/java/dev/siteforge/api/AuthSessionService.java', 'PBKDF2WithHmacSHA256', 'JdbcTemplate', 'auth_sessions'],
  'gin-gorm': ['apps/api/internal/auth/auth.go', 'pbkdf2Key', 'RegisterRoutes', 'database.AuthSession'],
}

describe('persistent session runtime scaffolds', () => {
  it('wires login, rotation, revocation and static-token fallback for every backend', () => {
    for (const profile of BACKEND_STACK_PROFILES) {
      const access = createDefaultManualAccess(entities)
      access.persistentSessions = true
      access.session = { ttlSeconds: 43_200, maxActiveSessions: 3 }
      const scaffold = createManualAccessProjectScaffold({
        name: `Runtime ${profile.shortName}`,
        backendStack: profile.id,
        database: profile.recommendedDatabase,
        includeDocker: false,
        includeGithubActions: false,
        entities,
        access,
      })
      const byPath = new Map(scaffold.files.map((file) => [file.path, file.content]))
      const [runtimePath, ...markers] = runtimeMarkers[profile.id]
      expect(byPath.has(runtimePath)).toBe(true)
      const combined = scaffold.files.map((file) => file.content).join('\n')
      for (const marker of markers) expect(combined).toContain(marker)
      for (const endpoint of ['/api/auth/bootstrap', '/api/auth/login', '/api/auth/logout', '/api/auth/rotate', '/api/auth/revoke-all']) {
        expect(combined).toContain(endpoint)
      }
      expect(combined).toContain('AUTH_IDENTITIES_JSON')
      expect(combined).toContain('INVALID_CREDENTIALS')
      expect(combined).toContain('SESSION_REQUIRED')
      expect(combined).toContain('600_000')
      expect(combined).toContain('sha256')
      expect(byPath.get('apps/web/src/AuthPanel.vue')).toContain('密码登录')
      expect(byPath.get('apps/web/src/AuthPanel.vue')).toContain('撤销全部')
      expect(byPath.get('apps/web/src/auth.ts')).toContain('loginWithPassword')
      expect(byPath.get('openapi.yaml')).toContain('/api/auth/login:')
      expect(byPath.get('openapi.yaml')).toContain('SessionResponse:')
      const policy = JSON.parse(byPath.get('siteforge.session.json')!)
      expect(policy).toMatchObject({
        status: 'runtime-ready',
        runtime: 'wired',
        session: { ttlSeconds: 43_200, maxActiveSessions: 3, tokenStorage: 'SHA-256 digest only' },
      })
    }
  })

  it('uses the first full-access custom role for administrator bootstrap', () => {
    const access = createDefaultManualAccess(entities)
    access.persistentSessions = true
    access.roles[0].key = 'owner'
    const scaffold = createManualAccessProjectScaffold({
      name: 'Owner bootstrap',
      backendStack: 'hono-drizzle',
      database: 'sqlite',
      includeDocker: false,
      includeGithubActions: false,
      entities,
      access,
    })
    const auth = scaffold.files.find((file) => file.path === 'apps/api/src/auth.ts')!.content
    expect(auth).toContain("const bootstrapRole = \"owner\"")
  })

  it('keeps schema-only session output when route authentication is disabled', () => {
    const access = createDefaultManualAccess(entities)
    access.enabled = false
    access.persistentSessions = true
    const scaffold = createManualAccessProjectScaffold({
      name: 'Schema only',
      backendStack: 'fastapi-sqlalchemy',
      database: 'sqlite',
      includeDocker: false,
      includeGithubActions: false,
      entities,
      access,
    })
    const byPath = new Map(scaffold.files.map((file) => [file.path, file.content]))
    expect(byPath.has('apps/api/migrations/versions/0002_auth_identity_sessions.py')).toBe(true)
    expect(byPath.has('apps/api/app/session_auth.py')).toBe(false)
    expect(JSON.parse(byPath.get('siteforge.session.json')!)).toMatchObject({ status: 'schema-ready', runtime: 'not-wired' })
  })
})
