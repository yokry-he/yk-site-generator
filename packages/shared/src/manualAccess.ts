import type { ManualEntityDefinition } from './manualProject'

export const MANUAL_PERMISSION_ACTIONS = ['list', 'read', 'create', 'update', 'delete'] as const
export const MAX_MANUAL_ROLES = 8

export type ManualPermissionAction = (typeof MANUAL_PERMISSION_ACTIONS)[number]

export interface ManualRolePermission {
  entity: string
  actions: ManualPermissionAction[]
}

export interface ManualRoleDefinition {
  key: string
  label: string
  description?: string
  permissions: ManualRolePermission[]
}

export interface ManualAccessDefinition {
  enabled: boolean
  roles: ManualRoleDefinition[]
}

const ROLE_KEY = /^[a-z][a-z0-9-]{1,31}$/

function cleanText(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim() : fallback
}

function cloneRoles(roles: readonly ManualRoleDefinition[]): ManualRoleDefinition[] {
  return roles.map((role) => ({
    ...role,
    permissions: role.permissions.map((permission) => ({
      entity: permission.entity,
      actions: [...permission.actions],
    })),
  }))
}

function permissionsFor(
  entities: readonly ManualEntityDefinition[],
  actions: readonly ManualPermissionAction[],
): ManualRolePermission[] {
  return entities.map((entity) => ({ entity: entity.name, actions: [...actions] }))
}

export function createDefaultManualAccess(
  entities: readonly ManualEntityDefinition[],
): ManualAccessDefinition {
  return {
    enabled: true,
    roles: [
      {
        key: 'admin',
        label: '管理员',
        description: '拥有所有资源的完整访问权限。',
        permissions: permissionsFor(entities, MANUAL_PERMISSION_ACTIONS),
      },
      {
        key: 'editor',
        label: '编辑者',
        description: '可以查看、新建和修改资源，但不能删除。',
        permissions: permissionsFor(entities, ['list', 'read', 'create', 'update']),
      },
      {
        key: 'viewer',
        label: '只读成员',
        description: '只能查看列表和详情。',
        permissions: permissionsFor(entities, ['list', 'read']),
      },
    ],
  }
}

export function normalizeManualAccess(
  input: ManualAccessDefinition | undefined,
  entities: readonly ManualEntityDefinition[],
): ManualAccessDefinition {
  const source = input ? { enabled: input.enabled !== false, roles: cloneRoles(input.roles) } : createDefaultManualAccess(entities)
  if (!source.roles.length) throw new Error('至少需要一个访问角色')
  if (source.roles.length > MAX_MANUAL_ROLES) throw new Error(`访问角色不能超过 ${MAX_MANUAL_ROLES} 个`)

  const entityNames = new Set(entities.map((entity) => entity.name))
  const roleKeys = new Set<string>()

  const roles = source.roles.map((rawRole, roleIndex) => {
    const key = cleanText(rawRole.key)
    const label = cleanText(rawRole.label)
    const description = cleanText(rawRole.description) || undefined

    if (!ROLE_KEY.test(key)) {
      throw new Error(`第 ${roleIndex + 1} 个角色标识必须使用小写字母、数字和连字符`)
    }
    if (!label) throw new Error(`${key} 缺少角色名称`)
    if (roleKeys.has(key)) throw new Error(`角色标识重复：${key}`)
    roleKeys.add(key)

    const merged = new Map<string, Set<ManualPermissionAction>>()
    for (const permission of rawRole.permissions ?? []) {
      const entity = cleanText(permission.entity)
      if (!entityNames.has(entity)) throw new Error(`${key} 引用了不存在的实体 ${entity}`)
      const actions = merged.get(entity) ?? new Set<ManualPermissionAction>()
      for (const action of permission.actions ?? []) {
        if (!MANUAL_PERMISSION_ACTIONS.includes(action)) {
          throw new Error(`${key}.${entity} 包含不支持的权限动作`)
        }
        actions.add(action)
      }
      merged.set(entity, actions)
    }

    return {
      key,
      label,
      description,
      permissions: entities
        .filter((entity) => merged.has(entity.name))
        .map((entity) => ({
          entity: entity.name,
          actions: MANUAL_PERMISSION_ACTIONS.filter((action) => merged.get(entity.name)?.has(action)),
        })),
    } satisfies ManualRoleDefinition
  })

  if (source.enabled) {
    const fullAccessRole = roles.some((role) => entities.every((entity) => {
      const permission = role.permissions.find((item) => item.entity === entity.name)
      return MANUAL_PERMISSION_ACTIONS.every((action) => permission?.actions.includes(action))
    }))
    if (!fullAccessRole) throw new Error('启用访问控制时，至少需要一个拥有全部资源权限的角色')
  }

  return { enabled: source.enabled, roles }
}

export function manualRoleCan(
  access: ManualAccessDefinition,
  roleKey: string,
  entityName: string,
  action: ManualPermissionAction,
): boolean {
  const role = access.roles.find((item) => item.key === roleKey)
  const permission = role?.permissions.find((item) => item.entity === entityName)
  return Boolean(permission?.actions.includes(action))
}
