/**
 * RBAC Filter Middleware
 * Automatic site and department restriction middleware
 */

import type { UserSession } from '@/lib/auth'
import type { AuthContext } from './auth'
import { isSuperAdmin } from './permission'
import { hasPermission } from '@/lib/rbac'
import { parseQuery } from '@/lib/api/query-parser'

/**
 * Filter context with RBAC restrictions applied
 */
export interface RBACFilterContext<T = any> extends AuthContext {
  filters: T
}

/**
 * Applies site restriction to query filters
 * Auto-restricts based on user's site if they have site_only permission
 * 
 * @example
 * ```ts
 * export const GET = withAuth(
 *   applySiteRestriction('attendance:site_only', async ({ user, filters }) => {
 *     // filters.siteId is auto-set if user has site_only permission
 *     const data = await prisma.attendance.findMany({ where: filters })
 *     return apiSuccess(data)
 *   })
 * )
 * ```
 */
export function applySiteRestriction<T extends Record<string, any> = Record<string, any>>(
  permission: string,
  handler: (context: RBACFilterContext<T>, routeContext?: any) => Promise<any>
) {
  return async (context: AuthContext, routeContext?: any) => {
    const { user, request } = context
    
    // Get initial filters from query params with sanitization
    const filters = parseQuery(new URL(request.url).searchParams) as any
    
    // Apply site restriction if user has the permission and is not SUPER_ADMIN
    if (!isSuperAdmin(user) && await hasPermission(permission, user)) {
      // Override siteId with user's site
      if (user.primarySiteId) {
        filters.siteId = user.primarySiteId
      } else if (user.siteId) {
        filters.siteId = user.siteId
      }
    }
    
    return handler({ ...context, filters }, routeContext)
  }
}

/**
 * Applies department restriction to query filters
 * Auto-restricts based on user's department if they have department_only permission
 */
export function applyDepartmentRestriction<T extends Record<string, any> = Record<string, any>>(
  permission: string,
  handler: (context: RBACFilterContext<T>, routeContext?: any) => Promise<any>
) {
  return async (context: AuthContext, routeContext?: any) => {
    const { user, request } = context
    
    // Get initial filters from query params with sanitization
    const filters = parseQuery(new URL(request.url).searchParams) as any
    
    // Apply department restriction if user has the permission and is not SUPER_ADMIN
    if (!isSuperAdmin(user) && await hasPermission(permission, user)) {
      // Override departmentId with user's department
      if (user.departmentId) {
        filters.departmentId = user.departmentId
      }
    }
    
    return handler({ ...context, filters }, routeContext)
  }
}

/**
 * Applies both site and department restrictions
 * Combines both restriction types
 */
export function applyRBACRestrictions<T extends Record<string, any> = Record<string, any>>(
  options: {
    sitePermission?: string
    departmentPermission?: string
  },
  handler: (context: RBACFilterContext<T>, routeContext?: any) => Promise<any>
) {
  return async (context: AuthContext, routeContext?: any) => {
    const { user, request } = context
    
    // Get initial filters from query params with sanitization
    const filters = parseQuery(new URL(request.url).searchParams) as any
    
    // Apply restrictions only if user is not SUPER_ADMIN
    if (!isSuperAdmin(user)) {
      // Apply site restriction
      if (options.sitePermission && await hasPermission(options.sitePermission, user)) {
        if (user.primarySiteId) {
          filters.siteId = user.primarySiteId
        } else if (user.siteId) {
          filters.siteId = user.siteId
        }
      }
      
      // Apply department restriction
      if (options.departmentPermission && await hasPermission(options.departmentPermission, user)) {
        if (user.departmentId) {
          filters.departmentId = user.departmentId
        }
      }
    }
    
    return handler({ ...context, filters }, routeContext)
  }
}

/**
 * Helper to create Prisma where clause with user relation filters
 * Useful for filtering data by siteId or departmentId on related user
 * 
 * @example
 * ```ts
 * const where = createUserRelationFilter(filters, ['siteId', 'departmentId'])
 * const attendance = await prisma.attendance.findMany({ where })
 * ```
 */
export function createUserRelationFilter(
  filters: Record<string, any>,
  fields: string[] = ['siteId', 'departmentId']
): any {
  const where: any = {}
  
  // Check if any of the fields are present in filters
  const userFilters: any = {}
  let hasUserFilters = false
  
  for (const field of fields) {
    if (filters[field]) {
      userFilters[field] = filters[field]
      hasUserFilters = true
    }
  }
  
  // If user filters exist, add them to user relation
  if (hasUserFilters) {
    where.user = userFilters
  }
  
  return where
}
