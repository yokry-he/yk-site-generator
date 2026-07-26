import { describe, expect, it } from 'vitest'
import { createDefaultManualAccess, type ManualEntityDefinition } from 'shared'
import { applyManualFineAuthorization, compileFineAuthorization } from '../src/lib/manualFineAuthorizationScaffold'

const entities: ManualEntityDefinition[] = [{
  name: 'Document', label: '文档', pluralLabel: '文档', route: '/documents',
  fields: [
    { name: 'title', label: '标题', type: 'text', required: true },
    { name: 'ownerId', label: '所有者', type: 'text', required: true },
    { name: 'internalCost', label: '内部成本', type: 'decimal', required: false },
  ], relations: [], list: { pageSize: 20, defaultSortField: 'id', defaultSortDirection: 'desc' },
}]

describe('fine-grained authorization scaffold', () => {
  it('derives sensitive fields and owner scope', () => {
    const policies = compileFineAuthorization(createDefaultManualAccess(entities), entities)
    const viewer = policies.find((item) => item.role === 'viewer')!.resources[0]
    expect(viewer.recordScope).toBe('owner')
    expect(viewer.scopeField).toBe('ownerId')
    expect(viewer.readableFields).not.toContain('internalCost')
    expect(viewer.writableFields).toEqual([])
  })

  it('emits an adapter and manifest for every stack', () => {
    const access = createDefaultManualAccess(entities)
    for (const stack of ['hono-drizzle', 'nestjs-prisma', 'fastapi-sqlalchemy', 'spring-boot-jpa', 'gin-gorm'] as const) {
      const files = applyManualFineAuthorization([{ path: '.env.example', content: '' }, { path: 'openapi.yaml', content: 'openapi: 3.1.0\n' }], stack, entities, access)
      expect(files.some((file) => file.path === 'siteforge.authorization.json')).toBe(true)
      expect(files.some((file) => /fine.authorization|fine_authorization|FineAuthorization/.test(file.path))).toBe(true)
      expect(files.find((file) => file.path === 'openapi.yaml')!.content).toContain('x-siteforge-fine-authorization')
    }
  })
})
