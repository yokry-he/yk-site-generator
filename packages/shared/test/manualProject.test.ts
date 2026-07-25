import { describe, expect, it } from 'vitest'
import {
  DEFAULT_MANUAL_ENTITIES,
  normalizeManualEntities,
  toKebabCase,
  toSnakeCase,
} from '../src/manualProject'

describe('manual project data models', () => {
  it('normalizes the default task resource without sharing mutable arrays', () => {
    const first = normalizeManualEntities()
    const second = normalizeManualEntities()
    expect(first).toEqual(DEFAULT_MANUAL_ENTITIES)
    first[0].fields[0].label = 'Changed'
    expect(second[0].fields[0].label).toBe('标题')
  })

  it('normalizes routes, enum values and display flags', () => {
    const [entity] = normalizeManualEntities([{
      name: 'Article',
      label: '文章',
      pluralLabel: '内容管理',
      route: 'content/articles/',
      fields: [{
        name: 'status',
        label: '状态',
        type: 'enum',
        required: true,
        enumValues: ['draft', ' published ', 'draft'],
      }],
    }])
    expect(entity.route).toBe('/content/articles')
    expect(entity.fields[0].enumValues).toEqual(['draft', 'published'])
    expect(entity.fields[0].showInList).toBe(true)
    expect(entity.fields[0].showInForm).toBe(true)
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

  it('provides stable identifier transforms', () => {
    expect(toKebabCase('AuditLogEntry')).toBe('audit-log-entry')
    expect(toSnakeCase('AuditLogEntry')).toBe('audit_log_entry')
  })
})
