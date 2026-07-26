import { describe, expect, it } from 'vitest'
import {
  createDefaultManualAccess,
  reconcileManualAccessEntities,
} from '../src/manualAccess'
import { normalizeManualEntities } from '../src/manualProject'

const first = normalizeManualEntities([
  {
    name: 'Task',
    label: '任务',
    pluralLabel: '任务管理',
    route: '/tasks',
    fields: [{ name: 'title', label: '标题', type: 'text', required: true }],
  },
])

const second = normalizeManualEntities([
  {
    name: 'WorkItem',
    label: '工作项',
    pluralLabel: '工作项管理',
    route: '/work-items',
    fields: [{ name: 'title', label: '标题', type: 'text', required: true }],
  },
  {
    name: 'Comment',
    label: '评论',
    pluralLabel: '评论管理',
    route: '/comments',
    fields: [{ name: 'body', label: '正文', type: 'long-text', required: true }],
  },
])

describe('manual role reconciliation', () => {
  it('preserves renamed permissions and extends built-in role presets to new entities', () => {
    const reconciled = reconcileManualAccessEntities(createDefaultManualAccess(first), first, second)
    expect(reconciled.roles.find((role) => role.key === 'admin')?.permissions).toEqual([
      { entity: 'WorkItem', actions: ['list', 'read', 'create', 'update', 'delete'] },
      { entity: 'Comment', actions: ['list', 'read', 'create', 'update', 'delete'] },
    ])
    expect(reconciled.roles.find((role) => role.key === 'editor')?.permissions[1].actions).toEqual([
      'list', 'read', 'create', 'update',
    ])
    expect(reconciled.roles.find((role) => role.key === 'viewer')?.permissions[1].actions).toEqual([
      'list', 'read',
    ])
  })

  it('does not grant new resources to a partial custom role', () => {
    const access = createDefaultManualAccess(first)
    access.roles.push({
      key: 'reviewer',
      label: '审核者',
      permissions: [{ entity: 'Task', actions: ['list', 'read', 'update'] }],
    })
    const reconciled = reconcileManualAccessEntities(access, first, second)
    expect(reconciled.roles.find((role) => role.key === 'reviewer')?.permissions).toEqual([
      { entity: 'WorkItem', actions: ['list', 'read', 'update'] },
      { entity: 'Comment', actions: [] },
    ])
  })
})
