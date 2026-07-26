import { describe, expect, it } from 'vitest'
import { BACKEND_STACK_PROFILES, type ManualEntityDefinition } from 'shared'
import { createManualProjectScaffold } from '../src/lib/manualProjectScaffold'

const entities: ManualEntityDefinition[] = [
  {
    name: 'User',
    label: '用户',
    pluralLabel: '用户管理',
    route: '/users',
    fields: [{ name: 'email', label: '邮箱', type: 'text', required: true, unique: true }],
    relations: [],
    list: { pageSize: 20, defaultSortField: 'email', defaultSortDirection: 'asc' },
  },
  {
    name: 'Article',
    label: '文章',
    pluralLabel: '内容管理',
    route: '/articles',
    fields: [{ name: 'title', label: '标题', type: 'text', required: true }],
    relations: [{ name: 'author', label: '作者', targetEntity: 'User', required: true, onDelete: 'restrict' }],
    list: { pageSize: 20, defaultSortField: 'id', defaultSortDirection: 'desc' },
  },
]

const markers: Record<string, string[]> = {
  'hono-drizzle': ['apps/api/src/index.ts', 'app.onError', 'ZodError'],
  'nestjs-prisma': ['apps/api/src/api-error.filter.ts', 'PrismaClientKnownRequestError', 'useGlobalFilters'],
  'fastapi-sqlalchemy': ['apps/api/app/main.py', 'RequestValidationError', 'IntegrityError'],
  'spring-boot-jpa': ['apps/api/src/main/java/dev/siteforge/api/ApiExceptionHandler.java', 'DataIntegrityViolationException', '@RestControllerAdvice'],
  'gin-gorm': ['apps/api/internal/handlers/errors.go', 'writeDatabaseError', 'VALIDATION_ERROR'],
}

describe('manual full-stack shared API errors', () => {
  it('emits structured validation, constraint and internal errors for every backend', () => {
    for (const profile of BACKEND_STACK_PROFILES) {
      const scaffold = createManualProjectScaffold({
        name: `Errors ${profile.shortName}`,
        backendStack: profile.id,
        database: profile.recommendedDatabase,
        includeDocker: false,
        includeGithubActions: false,
        entities,
      })
      const [path, firstMarker, secondMarker] = markers[profile.id]
      const target = scaffold.files.find((file) => file.path === path)
      const combined = scaffold.files.map((file) => file.content).join('\n')

      expect(target).toBeTruthy()
      expect(combined).toContain(firstMarker)
      expect(combined).toContain(secondMarker)
      expect(combined).toContain('VALIDATION_ERROR')
      expect(combined).toContain('CONSTRAINT_CONFLICT')
      expect(combined).toContain('INTERNAL_ERROR')
    }
  })

  it('does not expose raw Gin binding or database messages', () => {
    const scaffold = createManualProjectScaffold({
      name: 'Safe Gin Errors',
      backendStack: 'gin-gorm',
      database: 'sqlite',
      includeDocker: false,
      includeGithubActions: false,
      entities,
    })
    const handlers = scaffold.files.find((file) => file.path === 'apps/api/internal/handlers/resources.go')!.content
    expect(handlers).not.toContain('gin.H{"error":err.Error()}')
    expect(handlers).toContain('writeDatabaseError(c, err)')
  })

  it('documents the shared error schema and conflict responses in OpenAPI', () => {
    const scaffold = createManualProjectScaffold({
      name: 'Error Contract',
      backendStack: 'hono-drizzle',
      database: 'sqlite',
      includeDocker: false,
      includeGithubActions: false,
      entities,
    })
    const openapi = scaffold.files.find((file) => file.path === 'openapi.yaml')!.content
    expect(openapi).toContain('version: 0.3.0')
    expect(openapi).toContain('ErrorResponse:')
    expect(openapi).toContain('VALIDATION_ERROR')
    expect(openapi).toContain('CONSTRAINT_CONFLICT')
    expect(openapi).toContain("'400':")
    expect(openapi).toContain("'409':")
    expect(openapi).toContain('bearerAuth:')
  })
})
