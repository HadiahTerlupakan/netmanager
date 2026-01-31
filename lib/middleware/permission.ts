/**
 * Permission Middleware
 * Centralized permission checking middleware
 */

import { NextResponse } from 'next/server'
import { hasPermission } from '@/lib/rbac'
import type { UserSession } from '@/lib/auth'
import { ForbiddenError } from './error-handler'
import type { AuthContext } from './auth'

/**
 * Middleware to require specific permission
 * Must be used after withAuth middleware
 * 
 * @example
 * ```ts
 * import { withAuth, withPermission } from '@/lib/middleware'
 * 
 * export const GET = withAuth(
 *   withPermission('attendance:read', async ({ user, request }) => {
 *     // user has attendance:read permission
 *     return apiSuccess(data)
 *   })
 * )
 * ```
 */
export function withPermission<T = unknown>(
  permission: string,
  handler: (context: AuthContext, routeContext?: unknown) => Promise<NextResponse<T>>
) {
  return async (context: AuthContext, routeContext?: unknown): Promise<NextResponse> => {
    const { user } = context
    
    // Check permission
    const hasAccess = await hasPermission(permission, user)
    
    if (!hasAccess) {
      throw new ForbiddenError(`Anda tidak memiliki akses: ${permission}`)
    }

    return handler(context, routeContext)
  }
}

/**
 * Middleware to require ANY of the specified permissions
 * User needs at least one of the permissions
 * 
 * @example
 * ```ts
 * export const GET = withAuth(
 *   withAnyPermission(['attendance:read', 'attendance:admin'], async ({ user }) => {
 *     return apiSuccess(data)
 *   })
 * )
 * ```
 */
export function withAnyPermission<T = unknown>(
  permissions: string[],
  handler: (context: AuthContext, routeContext?: unknown) => Promise<NextResponse<T>>
) {
  return async (context: AuthContext, routeContext?: unknown): Promise<NextResponse> => {
    const { user } = context
    
    // Check if user has any of the permissions
    const { hasAnyPermission } = await import('@/lib/rbac')
    const hasAccess = await hasAnyPermission(permissions, user)
    
    if (!hasAccess) {
      throw new ForbiddenError(`Anda memerlukan salah satu izin: ${permissions.join(', ')}`)
    }

    return handler(context, routeContext)
  }
}

/**
 * Middleware to require ALL of the specified permissions
 * User needs all permissions
 * 
 * @example
 * ```ts
 * export const GET = withAuth(
 *   withAllPermissions(['attendance:read', 'attendance:export'], async ({ user }) => {
 *     return apiSuccess(data)
 *   })
 * )
 * ```
 */
export function withAllPermissions<T = unknown>(
  permissions: string[],
  handler: (context: AuthContext, routeContext?: unknown) => Promise<NextResponse<T>>
) {
  return async (context: AuthContext, routeContext?: unknown): Promise<NextResponse> => {
    const { user } = context
    
    // Check each permission
    const checks = await Promise.all(
      permissions.map(p => hasPermission(p, user))
    )
    
    const hasAllAccess = checks.every(result => result === true)
    
    if (!hasAllAccess) {
      throw new ForbiddenError(`Anda memerlukan semua izin: ${permissions.join(', ')}`)
    }

    return handler(context, routeContext)
  }
}

/**
 * Helper to check if user is SUPER_ADMIN
 */
export function isSuperAdmin(user: UserSession): boolean {
  return user.role === 'SUPER_ADMIN'
}
