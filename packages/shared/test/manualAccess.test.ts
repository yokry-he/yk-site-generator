import { describe, expect, it } from 'vitest'
import {
  createDefaultManualAccess,
  manualRoleCan,
  normalizeManualAccess,
} from '../src/manualAccess'
import { normalizeManualEntities } from '../src/manualProject'

const entities = normalizeManualEntities([
  {
    name: 'User',
    label: '用户',
    pluralLabel: '用户管理',
    route: '/users',
    fields: [{ name: 'email', label: '邮箱', type: 'text', required: true }],
  },
  {
    name: 'Article',
    label: '文章',
    pluralLabel: '内容管理',
    route: '/articles',
    fields: [{ name: 'title', label: '标题', type: 'text', required: true }],
  },
])

describe('manual project access control', () => {
  it('creates deterministic admin, editor and viewer permissions', () => {
    const access = createDefaultManualAccess(entities)
    expect(access.enabled).toBe(true)
    expect(access.roles.map((role) => role.key)).toEqual(['admin', 'editor', 'viewer'])
    expect(manualRoleCan(access, 'admin', 'Article', 'delete')).toBe(true)
    expect(manualRoleCan(access, 'editor', 'Article', 'update')).toBe(true)
    expect(manualRoleCan(access, 'editor', 'Article', 'delete')).toBe(false)
    expect(manualRoleCan(access, 'viewer', 'User', 'read')).toBe(true)
    expect(manualRoleCan(access, 'viewer', 'User', 'create')).toBe(false)
  })

  it('normalizes duplicate permission actions in entity order', () => {
    const access = normalizeManualAccess({
      enabled: true,
      roles: [{
        key: 'owner',
        label: '所有者',
        permissions: [
          { entity: 'Article', actions: ['read', 'read', 'delete'] },
          { entity: 'User', actions: ['list', 'read', 'create', 'update', 'delete'] },
          { entity: 'Article', actions: ['list', 'create', 'update'] },
        ],
      }],
    }, entities)

    expect(access.roles[0].permissions).toEqual([
      { entity: 'User', actions: ['list', 'read', 'create', 'update', 'delete'] },
      { entity: 'Article', actions: ['list', 'read', 'create', 'update', 'delete'] },
    ])
  })

  it('rejects unknown entities, duplicate roles and lockout policies', () => {
    expect(() => normalizeManualAccess({
      enabled: true,
      roles: [
        { key: 'admin', label: '管理员', permissions: [{ entity: 'Missing', actions: ['list'] }] },
      ],
    }, entities)).toThrow(/不存在的实体/)

    expect(() => normalizeManualAccess({
      enabled: false,
      roles: [
        { key: 'viewer', label: '只读', permissions: [] },
        { key: 'viewer', label: '重复', permissions: [] },
      ],
    }, entities)).toThrow(/角色标识重复/)

    expect(() => normalizeManualAccess({
      enabled: true,
      roles: [{
        key: 'viewer',
        label: '只读',
        permissions: entities.map((entity) => ({ entity: entity.name, actions: ['list', 'read'] })),
      }],
    }, entities)).toThrow(/全部资源权限/)
  })
})
