export const MANUAL_FIELD_TYPES = [
  'text',
  'long-text',
  'integer',
  'decimal',
  'boolean',
  'date',
  'datetime',
  'enum',
] as const

export type ManualFieldType = (typeof MANUAL_FIELD_TYPES)[number]

export interface ManualFieldDefinition {
  name: string
  label: string
  type: ManualFieldType
  required: boolean
  unique?: boolean
  showInList?: boolean
  showInForm?: boolean
  enumValues?: string[]
  defaultValue?: string
}

export interface ManualEntityDefinition {
  name: string
  label: string
  pluralLabel: string
  route: string
  fields: ManualFieldDefinition[]
}

export const MAX_MANUAL_ENTITIES = 8
export const MAX_MANUAL_FIELDS_PER_ENTITY = 20

const RESERVED_FIELD_NAMES = new Set(['id', 'createdAt', 'updatedAt'])
const PASCAL_IDENTIFIER = /^[A-Z][A-Za-z0-9]*$/
const CAMEL_IDENTIFIER = /^[a-z][A-Za-z0-9]*$/
const RESOURCE_ROUTE = /^\/[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*$/

export const DEFAULT_MANUAL_ENTITIES: readonly ManualEntityDefinition[] = [
  {
    name: 'Task',
    label: '任务',
    pluralLabel: '任务管理',
    route: '/tasks',
    fields: [
      {
        name: 'title',
        label: '标题',
        type: 'text',
        required: true,
        showInList: true,
        showInForm: true,
      },
      {
        name: 'description',
        label: '说明',
        type: 'long-text',
        required: false,
        showInList: false,
        showInForm: true,
      },
      {
        name: 'status',
        label: '状态',
        type: 'enum',
        required: true,
        enumValues: ['todo', 'in-progress', 'done'],
        defaultValue: 'todo',
        showInList: true,
        showInForm: true,
      },
      {
        name: 'priority',
        label: '优先级',
        type: 'integer',
        required: false,
        defaultValue: '0',
        showInList: true,
        showInForm: true,
      },
      {
        name: 'completed',
        label: '已完成',
        type: 'boolean',
        required: true,
        defaultValue: 'false',
        showInList: true,
        showInForm: true,
      },
    ],
  },
]

function cloneDefaultEntities(): ManualEntityDefinition[] {
  return DEFAULT_MANUAL_ENTITIES.map((entity) => ({
    ...entity,
    fields: entity.fields.map((field) => ({
      ...field,
      enumValues: field.enumValues ? [...field.enumValues] : undefined,
    })),
  }))
}

function cleanText(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim() : fallback
}

function normalizeRoute(value: string): string {
  const route = value.startsWith('/') ? value : `/${value}`
  return route.replace(/\/{2,}/g, '/').replace(/\/$/, '') || '/'
}

export function toKebabCase(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
}

export function toSnakeCase(value: string): string {
  return toKebabCase(value).replace(/-/g, '_')
}

export function lowerFirst(value: string): string {
  return value ? value[0].toLowerCase() + value.slice(1) : value
}

export function normalizeManualEntities(
  input?: readonly ManualEntityDefinition[],
): ManualEntityDefinition[] {
  const source = input?.length ? input : cloneDefaultEntities()
  if (source.length > MAX_MANUAL_ENTITIES) {
    throw new Error(`实体数量不能超过 ${MAX_MANUAL_ENTITIES} 个`)
  }

  const entityNames = new Set<string>()
  const routes = new Set<string>()

  return source.map((rawEntity, entityIndex) => {
    const name = cleanText(rawEntity.name)
    const label = cleanText(rawEntity.label)
    const pluralLabel = cleanText(rawEntity.pluralLabel, label)
    const route = normalizeRoute(cleanText(rawEntity.route, `/${toKebabCase(name)}`))

    if (!PASCAL_IDENTIFIER.test(name)) {
      throw new Error(`第 ${entityIndex + 1} 个实体名必须使用 PascalCase，例如 TaskItem`)
    }
    if (!label) throw new Error(`${name} 缺少显示名称`)
    if (!RESOURCE_ROUTE.test(route)) {
      throw new Error(`${name} 的路由不合法：${route}`)
    }
    if (entityNames.has(name)) throw new Error(`实体名重复：${name}`)
    if (routes.has(route)) throw new Error(`实体路由重复：${route}`)
    entityNames.add(name)
    routes.add(route)

    if (!Array.isArray(rawEntity.fields) || rawEntity.fields.length === 0) {
      throw new Error(`${name} 至少需要一个业务字段`)
    }
    if (rawEntity.fields.length > MAX_MANUAL_FIELDS_PER_ENTITY) {
      throw new Error(`${name} 的字段数量不能超过 ${MAX_MANUAL_FIELDS_PER_ENTITY} 个`)
    }

    const fieldNames = new Set<string>()
    const fields = rawEntity.fields.map((rawField, fieldIndex) => {
      const fieldName = cleanText(rawField.name)
      const fieldLabel = cleanText(rawField.label)
      const type = rawField.type

      if (!CAMEL_IDENTIFIER.test(fieldName)) {
        throw new Error(`${name} 的第 ${fieldIndex + 1} 个字段名必须使用 camelCase`)
      }
      if (RESERVED_FIELD_NAMES.has(fieldName)) {
        throw new Error(`${name}.${fieldName} 是系统保留字段`)
      }
      if (fieldNames.has(fieldName)) throw new Error(`${name} 字段重复：${fieldName}`)
      if (!fieldLabel) throw new Error(`${name}.${fieldName} 缺少显示名称`)
      if (!MANUAL_FIELD_TYPES.includes(type)) throw new Error(`${name}.${fieldName} 的字段类型不受支持`)
      fieldNames.add(fieldName)

      const enumValues = type === 'enum'
        ? [...new Set((rawField.enumValues ?? []).map((item) => item.trim()).filter(Boolean))]
        : undefined
      if (type === 'enum' && (!enumValues || enumValues.length < 2 || enumValues.length > 12)) {
        throw new Error(`${name}.${fieldName} 的枚举值需要 2 到 12 个`)
      }

      return {
        name: fieldName,
        label: fieldLabel,
        type,
        required: Boolean(rawField.required),
        unique: Boolean(rawField.unique),
        showInList: rawField.showInList !== false,
        showInForm: rawField.showInForm !== false,
        enumValues,
        defaultValue: cleanText(rawField.defaultValue) || undefined,
      } satisfies ManualFieldDefinition
    })

    return { name, label, pluralLabel, route, fields }
  })
}
