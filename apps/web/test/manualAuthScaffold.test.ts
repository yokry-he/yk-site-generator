import { describe, expect, it } from 'vitest'
import {
  BACKEND_STACK_PROFILES,
  type ManualEntityDefinition,
} from 'shared'
import { createManualProjectScaffold } from '../src/lib/manualProjectScaffold'

const entities: ManualEntityDefinition[] = [
  {
    name: 'User',
    label: '用户',
    pluralLabel: '用户管理',
    route: '/users',
    fields: [
      { name: 'email', label: '邮箱', type: 'text', required: true, unique: true },
    ],
    relations: [],
    list: { pageSize: 20, defaultSortField: 'email', defaultSortDirection: 'asc' },
  },
  {
    name: 'Article',
    label: '文章',
    pluralLabel: '内容管理',
    route: '/articles',
    fields: [
      { name: 'title', label: '标题', type: 'text', required: true, searchable: true },
    ],
    relations: [{
      name: 'author',
      label: '作者',
      targetEntity: 'User',
      required: true,
      onDelete: 'restrict',
    }],
    list: { pageSize: 25, defaultSortField: 'id', defaultSortDirection: 'desc' },
  },
]

const backendMarkers: Record<string, string[]> = {
  'hono-drizzle': ['apps/api/src/auth.ts', 'timingSafeEqual', "app.use('/api/*', authMiddleware)"],
  'nestjs-prisma': ['apps/api/src/auth.guard.ts', 'timingSafeEqual', 'APP_GUARD'],
  'fastapi-sqlalchemy': ['apps/api/app/auth.py', 'hmac.compare_digest', 'AuthMiddleware'],
  'spring-boot-jpa': ['apps/api/src/main/java/dev/siteforge/api/AuthFilter.java', 'MessageDigest.isEqual', 'OncePerRequestFilter'],
  'gin-gorm': ['apps/api/internal/auth/auth.go', 'subtle.ConstantTimeCompare', 'auth.Middleware()'],
}

describe('manual authorization scaffolds', () => {
  it('adds bearer-token RBAC, policy metadata and a frontend token panel to every backend', () => {
    for (const profile of BACKEND_STACK_PROFILES) {
      const scaffold = createManualProjectScaffold({
        name: `Secured ${profile.shortName}`,
        backendStack: profile.id,
        database: profile.recommendedDatabase,
        includeDocker: false,
        includeGithubActions: false,
        entities,
      })
      const paths = new Set(scaffold.files.map((file) => file.path))
      const combined = scaffold.files.map((file) => file.content).join('\n')
      const [authPath, constantTimeMarker, integrationMarker] = backendMarkers[profile.id]

      expect(paths).toContain(authPath)
      expect(paths).toContain('apps/web/src/auth.ts')
      expect(paths).toContain('apps/web/src/AuthPanel.vue')
      expect(paths).toContain('siteforge.auth.json')
      expect(paths).toContain('AUTHORIZATION.md')
      expect(combined).toContain(constantTimeMarker)
      expect(combined).toContain(integrationMarker)
      expect(combined).toContain('AUTH_IDENTITIES_JSON')
      expect(combined).toContain('AUTH_NOT_CONFIGURED')
      expect(combined).toContain('UNAUTHORIZED')
      expect(combined).toContain('FORBIDDEN')
      expect(combined).toContain('sha256')
      expect(combined).toContain('/api/auth/me')
    }
  })

  it('emits deterministic default roles and OpenAPI bearer security', () => {
    const scaffold = createManualProjectScaffold({
      name: 'Authorization Matrix',
      backendStack: 'hono-drizzle',
      database: 'sqlite',
      includeDocker: false,
      includeGithubActions: false,
      entities,
    })
    const policy = JSON.parse(scaffold.files.find((file) => file.path === 'siteforge.auth.json')!.content)
    const openapi = scaffold.files.find((file) => file.path === 'openapi.yaml')!.content
    const env = scaffold.files.find((file) => file.path === '.env.example')!.content
    const app = scaffold.files.find((file) => file.path === 'apps/web/src/App.vue')!.content

    expect(policy).toMatchObject({
      schemaVersion: 1,
      strategy: 'opaque-bearer',
      enabledByDefault: false,
      publicRoutes: ['/api/health'],
      roles: [
        { key: 'admin' },
        { key: 'editor' },
        { key: 'viewer' },
      ],
    })
    expect(policy.roles[0].permissions).toEqual([
      { entity: 'User', actions: ['list', 'read', 'create', 'update', 'delete'] },
      { entity: 'Article', actions: ['list', 'read', 'create', 'update', 'delete'] },
    ])
    expect(openapi).toContain('securitySchemes:')
    expect(openapi).toContain('bearerAuth:')
    expect(openapi).toContain('/api/auth/me:')
    expect(env).toContain('AUTH_ENABLED=false')
    expect(env).toContain('replace-with-at-least-32-random-characters')
    expect(app).toContain("import { authFetch } from './auth'")
    expect(app).toContain('<AuthPanel :api-base="apiBase"')
    expect(scaffold.files.find((file) => file.path === 'apps/web/src/auth.ts')!.content).toContain('sessionStorage')
    expect(app).not.toContain('const response = await fetch(')
  })
})
