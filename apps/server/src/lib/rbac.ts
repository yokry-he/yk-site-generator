import type { MiddlewareHandler } from 'hono'
import type { AuthEnv } from './auth'
import { readData, type UserRecord, type UserRole } from './data-store'

export const PERMISSIONS = [
  'admin.overview.read',
  'users.read',
  'users.update_status',
  'users.update_role',
  'templates.read',
  'templates.publish',
  'feedback.read',
  'feedback.resolve',
  'audit.read',
  'events.read',
  'health.read',
  'feature_flags.read',
  'feature_flags.write',
] as const

export type Permission = (typeof PERMISSIONS)[number]

const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  user: [],
  support: [
    'admin.overview.read',
    'users.read',
    'templates.read',
    'feedback.read',
    'feedback.resolve',
    'audit.read',
    'health.read',
  ],
  admin: PERMISSIONS,
}

export function permissionsForRole(role: UserRole): Permission[] {
  return [...ROLE_PERMISSIONS[role]]
}

export function userRole(user: UserRecord): UserRole {
  return user.role ?? 'user'
}

export function hasPermission(user: UserRecord, permission: Permission): boolean {
  return ROLE_PERMISSIONS[userRole(user)].includes(permission)
}

export async function currentAuthorizedUser(userId: string): Promise<UserRecord | null> {
  const user = (await readData()).users.find((item) => item.id === userId)
  return user && (user.status ?? 'active') === 'active' ? user : null
}

export const operatorMiddleware: MiddlewareHandler<AuthEnv> = async (c, next) => {
  const user = await currentAuthorizedUser(c.get('auth').sub)
  if (!user || permissionsForRole(userRole(user)).length === 0) {
    return c.json({ error: { code: 'FORBIDDEN', message: '当前账号没有运营控制台权限' } }, 403)
  }
  await next()
}

export function permissionMiddleware(permission: Permission): MiddlewareHandler<AuthEnv> {
  return async (c, next) => {
    const user = await currentAuthorizedUser(c.get('auth').sub)
    if (!user || !hasPermission(user, permission)) {
      return c.json({
        error: {
          code: 'PERMISSION_DENIED',
          message: `缺少权限：${permission}`,
        },
      }, 403)
    }
    await next()
  }
}
