import type { Role } from '../db/models'

export const PERMISSIONS = {
  'admin:view': ['ADMIN', 'CONTENT_MANAGER'],
  'admin:users': ['ADMIN'],
  'admin:roles': ['ADMIN'],
  'admin:flags': ['ADMIN'],
  'admin:audit': ['ADMIN'],
  'admin:usage': ['ADMIN'],
  'admin:errors': ['ADMIN'],
  'content:manage': ['ADMIN', 'CONTENT_MANAGER'],
} as const satisfies Record<string, readonly Role[]>

export type Permission = keyof typeof PERMISSIONS

export function can(role: Role | null | undefined, permission: Permission): boolean {
  if (!role) return false
  return (PERMISSIONS[permission] as readonly Role[]).includes(role)
}

export const ROLES: Role[] = ['USER', 'CONTENT_MANAGER', 'ADMIN']
