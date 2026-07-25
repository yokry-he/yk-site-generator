import { describe, expect, it } from 'vitest'
import {
  DEFAULT_MANUAL_ENTITIES,
  normalizeManualEntities,
  relationIdField,
  toKebabCase,
  toSnakeCase,
} from '../src/manualProject'

describe('manual project data models', () => {
  it('normalizes the default task resource without sharing mutable arrays', () => {
    const first = normalizeManualEntities()
    const second = normalizeManualEntities()
    expect(first[0]).toMatchObject(DEFAULT_MANUAL_ENTITIES[0])
    expect(first[0].fields).toHaveLength(DEFAULT_MANUAL_ENTITIES[0].fields.length)
    expect(first[0].list).toEqual({ pageSize: 20, defaultSortField: 'id', defaultSortDirection: 'desc' })
    first[0].fields[0].label = 'Changed'
    first[0].list!.pageSize = 50
    expect(second[0].fields[0].label).toBe('标题')
    expect(second[0].list?.pageSize).toBe(20)
    expect(DEFAULT_MANUAL_ENTITIES[0].fields[0].label).toBe('标题')
  })

  it('normalizes routes, enum values, search flags and list settings', () => {
    const [entity] = normalizeManualEntities([{
      name: 'Article',
      label: '文章',
      pluralLabel: '内容管理',
      route: 'content/articles/',
      fields: [
        {
          name: 'status',
          label: '状态',
          type: 'enum',
          required: true,
          enumValues: ['draft', ' published ', 'draft'],
        },
        {
          name: 'priority',
          label: '优先级',
          type: 'integer',
          required: false,
          searchable: true,
        },
      ],
      list: { pageSize: 25, defaultSortField: 'status', defaultSortDirection: 'asc' },
    }])
    expect(entity.route).toBe('/content/articles')
    expect(entity.fields[0].enumValues).toEqual(['draft', 'published'])
    expect(entity.fields[0].searchable).toBe(true)
    expect(entity.fields[1].searchable).toBe(false)
    expect(entity.fields[0].showInList).toBe(true)
    expect(entity.fields[0].showInForm).toBe(true)
    expect(entity.list).toEqual({ pageSize: 25, defaultSortField: 'status', defaultSortDirection: 'asc' })
  })

  it('normalizes belongs-to relations and referential actions', () => {
    const entities = normalizeManualEntities([
      {
        name: 'User',
        label: '用户',
        pluralLabel: '用户管理',
        route: '/users',
        fields: [{ name: 'name', label: '姓名', type: 'text', required: true }],
      },
      {
        name: 'Task',
        label: '任务',
        pluralLabel: '任务管理',
        route: '/tasks',
        fields: [{ name: 'title', label: '标题', type: 'text', required: true }],
        relations: [{
          name: 'assignee',
          label: '负责人',
          targetEntity: 'User',
          required: false,
          onDelete: 'set-null',
        }],
        list: { pageSize: 20, defaultSortField: 'assigneeId', defaultSortDirection: 'asc' },
      },
    ])
    expect(entities[1].relations).toEqual([{
      name: 'assignee',
      label: '负责人',
      targetEntity: 'User',
      required: false,
      onDelete: 'set-null',
      sortable: true,
      showInList: true,
      showInForm: true,
    }])
    expect(relationIdField(entities[1].relations![0])).toBe('assigneeId')
    expect(entities[1].list?.defaultSortField).toBe('assigneeId')
  })

  it('rejects duplicate routes, reserved fields and malformed identifiers', () => {
    expect(() => normalizeManualEntities([
      { name: 'Task', label: '任务', pluralLabel: '任务', route: '/tasks', fields: [{ name: 'title', label: '标题', type: 'text', required: true }] },
      { name: 'Note', label: '笔记', pluralLabel: '笔记', route: '/tasks', fields: [{ name: 'body', label: '正文', type: 'long-text', required: true }] },
    ])).toThrow(/路由重复/)
    expect(() => normalizeManualEntities([
      { name: 'Task', label: '任务', pluralLabel: '任务', route: '/tasks', fields: [{ name: 'id', label: '编号', type: 'integer', required: true }] },
    ])).toThrow(/系统保留字段/)
    expect(() => normalizeManualEntities([
      { name: 'task', label: '任务', pluralLabel: '任务', route: '/tasks', fields: [{ name: 'title', label: '标题', type: 'text', required: true }] },
    ])).toThrow(/PascalCase/)
  })

  it('rejects forward relations, invalid set-null and unsafe sort settings', () => {
    expect(() => normalizeManualEntities([
      {
        name: 'Task', label: '任务', pluralLabel: '任务', route: '/tasks',
        fields: [{ name: 'title', label: '标题', type: 'text', required: true }],
        relations: [{ name: 'owner', label: '所有者', targetEntity: 'User', required: true, onDelete: 'restrict' }],
      },
      { name: 'User', label: '用户', pluralLabel: '用户', route: '/users', fields: [{ name: 'name', label: '姓名', type: 'text', required: true }] },
    ])).toThrow(/之前定义的实体/)

    expect(() => normalizeManualEntities([
      { name: 'User', label: '用户', pluralLabel: '用户', route: '/users', fields: [{ name: 'name', label: '姓名', type: 'text', required: true }] },
      {
        name: 'Task', label: '任务', pluralLabel: '任务', route: '/tasks',
        fields: [{ name: 'title', label: '标题', type: 'text', required: true }],
        relations: [{ name: 'owner', label: '所有者', targetEntity: 'User', required: true, onDelete: 'set-null' }],
      },
    ])).toThrow(/不能使用 set-null/)

    expect(() => normalizeManualEntities([{
      name: 'Task', label: '任务', pluralLabel: '任务', route: '/tasks',
      fields: [{ name: 'title', label: '标题', type: 'text', required: true, sortable: false }],
      list: { pageSize: 20, defaultSortField: 'title', defaultSortDirection: 'asc' },
    }])).toThrow(/默认排序字段不可排序/)
  })

  it('provides stable identifier transforms', () => {
    expect(toKebabCase('AuditLogEntry')).toBe('audit-log-entry')
    expect(toSnakeCase('AuditLogEntry')).toBe('audit_log_entry')
  })
})
