export type UserRole = 'user' | 'support' | 'admin'

export type Permission =
  | 'admin.overview.read'
  | 'users.read'
  | 'users.update_status'
  | 'users.update_role'
  | 'templates.read'
  | 'templates.publish'
  | 'feedback.read'
  | 'feedback.resolve'
  | 'audit.read'
  | 'events.read'
  | 'health.read'
  | 'feature_flags.read'
  | 'feature_flags.write'

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
  admin: [
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
  ],
}

export function permissionsForRole(role: UserRole): Permission[] {
  return [...ROLE_PERMISSIONS[role]]
}

export function roleHasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission)
}
