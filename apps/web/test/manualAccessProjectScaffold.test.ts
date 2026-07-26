import { describe, expect, it } from 'vitest'
import {
  MANUAL_PERMISSION_ACTIONS,
  type ManualAccessDefinition,
  type ManualEntityDefinition,
} from 'shared'
import { createManualAccessProjectScaffold } from '../src/lib/manualAccessProjectScaffold'

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
    relations: [],
    list: { pageSize: 20, defaultSortField: 'id', defaultSortDirection: 'desc' },
  },
]

const access: ManualAccessDefinition = {
  enabled: true,
  roles: [
    {
      key: 'owner',
      label: '所有者',
      permissions: entities.map((entity) => ({ entity: entity.name, actions: [...MANUAL_PERMISSION_ACTIONS] })),
    },
    {
      key: 'reviewer',
      label: '审核者',
      permissions: [
        { entity: 'User', actions: ['list', 'read'] },
        { entity: 'Article', actions: ['list', 'read', 'update'] },
      ],
    },
  ],
}

describe('manual access project scaffold', () => {
  it('replaces default authorization output with the visual role matrix', () => {
    const scaffold = createManualAccessProjectScaffold({
      name: 'Editorial Console',
      backendStack: 'hono-drizzle',
      database: 'sqlite',
      includeDocker: false,
      includeGithubActions: false,
      entities,
      access,
    })
    const policy = JSON.parse(scaffold.files.find((file) => file.path === 'siteforge.auth.json')!.content)
    const auth = scaffold.files.find((file) => file.path === 'apps/api/src/auth.ts')!.content

    expect(scaffold.access.roles.map((role) => role.key)).toEqual(['owner', 'reviewer'])
    expect(policy.roles).toMatchObject([
      { key: 'owner' },
      { key: 'reviewer', permissions: [{ entity: 'User' }, { entity: 'Article' }] },
    ])
    expect(auth).toContain('"reviewer"')
    expect(auth).toContain('"Article":["list","read","update"]')
    expect(auth).not.toContain('"admin"')
  })

  it('removes default runtime authentication files when visual access generation is disabled', () => {
    const scaffold = createManualAccessProjectScaffold({
      name: 'Public Console',
      backendStack: 'hono-drizzle',
      database: 'sqlite',
      includeDocker: false,
      includeGithubActions: false,
      entities,
      access: { ...access, enabled: false },
    })
    const paths = new Set(scaffold.files.map((file) => file.path))
    const policy = JSON.parse(scaffold.files.find((file) => file.path === 'siteforge.auth.json')!.content)

    expect(paths).not.toContain('apps/api/src/auth.ts')
    expect(paths).not.toContain('apps/web/src/AuthPanel.vue')
    expect(paths).not.toContain('apps/web/src/auth.ts')
    expect(policy.enabledByDefault).toBe(false)
    expect(policy.roles.map((role: { key: string }) => role.key)).toEqual(['owner', 'reviewer'])
  })

  it('rejects a generated policy without a full-access role', () => {
    expect(() => createManualAccessProjectScaffold({
      name: 'Locked Console',
      backendStack: 'hono-drizzle',
      database: 'sqlite',
      entities,
      access: {
        enabled: true,
        roles: [{
          key: 'viewer',
          label: '只读',
          permissions: entities.map((entity) => ({ entity: entity.name, actions: ['list', 'read'] })),
        }],
      },
    })).toThrow(/全部资源权限/)
  })
})
