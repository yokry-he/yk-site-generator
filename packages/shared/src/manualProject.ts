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

export const MANUAL_RELATION_ON_DELETE_ACTIONS = ['restrict', 'cascade', 'set-null'] as const
export const MANUAL_SORT_DIRECTIONS = ['asc', 'desc'] as const

export type ManualFieldType = (typeof MANUAL_FIELD_TYPES)[number]
export type ManualRelationOnDelete = (typeof MANUAL_RELATION_ON_DELETE_ACTIONS)[number]
export type ManualSortDirection = (typeof MANUAL_SORT_DIRECTIONS)[number]

export interface ManualFieldDefinition {
  name: string
  label: string
  type: ManualFieldType
  required: boolean
  unique?: boolean
  searchable?: boolean
  sortable?: boolean
  showInList?: boolean
  showInForm?: boolean
  enumValues?: string[]
  defaultValue?: string
}

export interface ManualRelationDefinition {
  name: string
  label: string
  targetEntity: string
  required: boolean
  onDelete: ManualRelationOnDelete
  sortable?: boolean
  showInList?: boolean
  showInForm?: boolean
}

export interface ManualListDefinition {
  pageSize: number
  defaultSortField: string
  defaultSortDirection: ManualSortDirection
}

export interface ManualEntityDefinition {
  name: string
  label: string
  pluralLabel: string
  route: string
  fields: ManualFieldDefinition[]
  relations?: ManualRelationDefinition[]
  list?: ManualListDefinition
}

export const MAX_MANUAL_ENTITIES = 8
export const MAX_MANUAL_FIELDS_PER_ENTITY = 20
export const MAX_MANUAL_RELATIONS_PER_ENTITY = 8
export const MIN_MANUAL_PAGE_SIZE = 5
export const MAX_MANUAL_PAGE_SIZE = 100

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
        searchable: true,
        sortable: true,
        showInList: true,
        showInForm: true,
      },
      {
        name: 'description',
        label: '说明',
        type: 'long-text',
        required: false,
        searchable: true,
        sortable: false,
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
        searchable: true,
        sortable: true,
        showInList: true,
        showInForm: true,
      },
      {
        name: 'priority',
        label: '优先级',
        type: 'integer',
        required: false,
        defaultValue: '0',
        searchable: false,
        sortable: true,
        showInList: true,
        showInForm: true,
      },
      {
        name: 'completed',
        label: '已完成',
        type: 'boolean',
        required: true,
        defaultValue: 'false',
        searchable: false,
        sortable: true,
        showInList: true,
        showInForm: true,
      },
    ],
    relations: [],
    list: {
      pageSize: 20,
      defaultSortField: 'id',
      defaultSortDirection: 'desc',
    },
  },
]

function cloneEntities(input: readonly ManualEntityDefinition[]): ManualEntityDefinition[] {
  return input.map((entity) => ({
    ...entity,
    fields: entity.fields.map((field) => ({
      ...field,
      enumValues: field.enumValues ? [...field.enumValues] : undefined,
    })),
    relations: entity.relations?.map((relation) => ({ ...relation })) ?? [],
    list: entity.list ? { ...entity.list } : undefined,
  }))
}

function cleanText(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim() : fallback
}

function normalizeRoute(value: string): string {
  const route = value.startsWith('/') ? value : `/${value}`
  return route.replace(/\/{2,}/g, '/').replace(/\/$/, '') || '/'
}

function normalizePageSize(value: unknown): number {
  const number = typeof value === 'number' ? value : Number(value)
  if (!Number.isInteger(number) || number < MIN_MANUAL_PAGE_SIZE || number > MAX_MANUAL_PAGE_SIZE) {
    throw new Error(`每页数量必须是 ${MIN_MANUAL_PAGE_SIZE} 到 ${MAX_MANUAL_PAGE_SIZE} 之间的整数`)
  }
  return number
}

function isSearchableType(type: ManualFieldType): boolean {
  return type === 'text' || type === 'long-text' || type === 'enum'
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

export function relationIdField(relation: Pick<ManualRelationDefinition, 'name'>): string {
  return `${relation.name}Id`
}

export function normalizeManualEntities(
  input?: readonly ManualEntityDefinition[],
): ManualEntityDefinition[] {
  const source = input?.length ? cloneEntities(input) : cloneEntities(DEFAULT_MANUAL_ENTITIES)
  if (source.length > MAX_MANUAL_ENTITIES) {
    throw new Error(`实体数量不能超过 ${MAX_MANUAL_ENTITIES} 个`)
  }

  const entityNames = new Set<string>()
  const routes = new Set<string>()

  const normalized = source.map((rawEntity, entityIndex) => {
    const name = cleanText(rawEntity.name)
    const label = cleanText(rawEntity.label)
    const pluralLabel = cleanText(rawEntity.pluralLabel, label)
    const route = normalizeRoute(cleanText(rawEntity.route, `/${toKebabCase(name)}`))

    if (!PASCAL_IDENTIFIER.test(name)) {
      throw new Error(`第 ${entityIndex + 1} 个实体名必须使用 PascalCase，例如 TaskItem`)
    }
    if (!label) throw new Error(`${name} 缺少显示名称`)
    if (!RESOURCE_ROUTE.test(route)) throw new Error(`${name} 的路由不合法：${route}`)
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
      if (RESERVED_FIELD_NAMES.has(fieldName)) throw new Error(`${name}.${fieldName} 是系统保留字段`)
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

      const defaultValue = cleanText(rawField.defaultValue) || undefined
      if (type === 'enum' && defaultValue && !enumValues?.includes(defaultValue)) {
        throw new Error(`${name}.${fieldName} 的默认值必须属于枚举值`)
      }
      if (type === 'boolean' && defaultValue && defaultValue !== 'true' && defaultValue !== 'false') {
        throw new Error(`${name}.${fieldName} 的布尔默认值只能是 true 或 false`)
      }
      if ((type === 'integer' || type === 'decimal') && defaultValue && !Number.isFinite(Number(defaultValue))) {
        throw new Error(`${name}.${fieldName} 的数字默认值不合法`)
      }

      return {
        name: fieldName,
        label: fieldLabel,
        type,
        required: Boolean(rawField.required),
        unique: Boolean(rawField.unique),
        searchable: isSearchableType(type) && rawField.searchable !== false,
        sortable: rawField.sortable !== false,
        showInList: rawField.showInList !== false,
        showInForm: rawField.showInForm !== false,
        enumValues,
        defaultValue,
      } satisfies ManualFieldDefinition
    })

    return {
      name,
      label,
      pluralLabel,
      route,
      fields,
      relations: rawEntity.relations ?? [],
      list: rawEntity.list,
    } satisfies ManualEntityDefinition
  })

  const entityIndexByName = new Map(normalized.map((entity, index) => [entity.name, index]))

  return normalized.map((entity, entityIndex) => {
    const rawRelations = entity.relations ?? []
    if (rawRelations.length > MAX_MANUAL_RELATIONS_PER_ENTITY) {
      throw new Error(`${entity.name} 的关系数量不能超过 ${MAX_MANUAL_RELATIONS_PER_ENTITY} 个`)
    }

    const occupiedNames = new Set(entity.fields.map((field) => field.name))
    const relationNames = new Set<string>()
    const relations = rawRelations.map((rawRelation, relationIndex) => {
      const name = cleanText(rawRelation.name)
      const label = cleanText(rawRelation.label)
      const targetEntity = cleanText(rawRelation.targetEntity)
      const targetIndex = entityIndexByName.get(targetEntity)
      const onDelete = rawRelation.onDelete ?? 'restrict'

      if (!CAMEL_IDENTIFIER.test(name)) {
        throw new Error(`${entity.name} 的第 ${relationIndex + 1} 个关系名必须使用 camelCase`)
      }
      if (!label) throw new Error(`${entity.name}.${name} 缺少关系显示名称`)
      if (relationNames.has(name)) throw new Error(`${entity.name} 关系重复：${name}`)
      if (occupiedNames.has(name) || occupiedNames.has(`${name}Id`) || RESERVED_FIELD_NAMES.has(name)) {
        throw new Error(`${entity.name}.${name} 与已有字段冲突`)
      }
      if (targetIndex === undefined) throw new Error(`${entity.name}.${name} 指向不存在的实体 ${targetEntity}`)
      if (targetIndex >= entityIndex) {
        throw new Error(`${entity.name}.${name} 只能关联当前实体之前定义的实体`)
      }
      if (!MANUAL_RELATION_ON_DELETE_ACTIONS.includes(onDelete)) {
        throw new Error(`${entity.name}.${name} 的删除策略不受支持`)
      }
      if (rawRelation.required && onDelete === 'set-null') {
        throw new Error(`${entity.name}.${name} 为必填关系，不能使用 set-null`)
      }

      relationNames.add(name)
      occupiedNames.add(name)
      occupiedNames.add(`${name}Id`)
      return {
        name,
        label,
        targetEntity,
        required: Boolean(rawRelation.required),
        onDelete,
        sortable: rawRelation.sortable !== false,
        showInList: rawRelation.showInList !== false,
        showInForm: rawRelation.showInForm !== false,
      } satisfies ManualRelationDefinition
    })

    const sortableFields = new Set([
      'id',
      'createdAt',
      'updatedAt',
      ...entity.fields.filter((field) => field.sortable !== false).map((field) => field.name),
      ...relations.filter((relation) => relation.sortable !== false).map(relationIdField),
    ])
    const defaultSortField = cleanText(entity.list?.defaultSortField, 'id')
    const defaultSortDirection = entity.list?.defaultSortDirection ?? 'desc'
    if (!sortableFields.has(defaultSortField)) {
      throw new Error(`${entity.name} 的默认排序字段不可排序：${defaultSortField}`)
    }
    if (!MANUAL_SORT_DIRECTIONS.includes(defaultSortDirection)) {
      throw new Error(`${entity.name} 的默认排序方向不合法`)
    }

    return {
      ...entity,
      relations,
      list: {
        pageSize: normalizePageSize(entity.list?.pageSize ?? 20),
        defaultSortField,
        defaultSortDirection,
      },
    }
  })
}
