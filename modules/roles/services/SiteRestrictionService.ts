import type { Session } from 'next-auth'

/**
 * Site Restriction Service
 * 
 * Bagian dari modul Roles - mengatur akses berbasis Site.
 * 
 * Logika site_only permission:
 * - Jika role MEMILIKI `resource:site_only` → User dibatasi ke site mereka
 * - Jika role TIDAK MEMILIKI `resource:site_only` → User bisa lihat semua site
 * - SUPER_ADMIN selalu bypass (bisa lihat semua)
 * 
 * Penggunaan:
 * ```typescript
 * import { getSiteFilter, canAccessSite, checkSiteRestriction } from '@/modules/roles'
 * 
 * // Di API route GET (list)
 * const { siteId, isRestricted } = checkSiteRestriction(session, 'users')
 * const users = await userService.getAllUsers(siteId)
 * 
 * // Di API route GET/PUT/DELETE (single item)
 * if (!canAccessSite(session, 'users', targetUser.siteId)) {
 *   return NextResponse.json({ error: 'Access denied' }, { status: 403 })
 * }
 * ```
 */

export interface SiteRestrictionResult {
    isRestricted: boolean
    siteId: string | undefined
    userSiteId: string | null
}

interface SessionUser {
    id: string
    role?: string
    permissions?: string[]
    siteId?: string | null
}

/**
 * Check site restriction status for a user and resource
 * @param session - NextAuth session
 * @param resource - Resource name (e.g., 'users', 'list', 'attendance')
 * @returns Object with restriction status and siteId filter
 */
export function checkSiteRestriction(
    session: Session | null,
    resource: string
): SiteRestrictionResult {
    if (!session?.user) {
        return { isRestricted: false, siteId: undefined, userSiteId: null }
    }

    const user = session.user as SessionUser
    const permissions = user.permissions || []
    const role = user.role
    const userSiteId = user.siteId || null

    // SUPER_ADMIN bypass - always can see all
    if (role === 'SUPER_ADMIN') {
        return { isRestricted: false, siteId: undefined, userSiteId }
    }

    // Check for site_only permission
    const siteOnlyPermission = `${resource}:site_only`
    const isRestricted = permissions.includes(siteOnlyPermission)

    if (isRestricted) {
        return {
            isRestricted: true,
            siteId: userSiteId || undefined,
            userSiteId
        }
    }

    return { isRestricted: false, siteId: undefined, userSiteId }
}

/**
 * Get site filter for query (shorthand)
 * @returns siteId if restricted, undefined if can see all
 */
export function getSiteFilter(
    session: Session | null,
    resource: string
): string | undefined {
    return checkSiteRestriction(session, resource).siteId
}

/**
 * Check if user can access a specific site's data
 * @param session - NextAuth session
 * @param resource - Resource name
 * @param targetSiteId - Site ID of the target resource
 * @returns true if user can access, false if denied
 */
export function canAccessSite(
    session: Session | null,
    resource: string,
    targetSiteId: string | null | undefined
): boolean {
    const { isRestricted, siteId } = checkSiteRestriction(session, resource)
    
    if (!isRestricted) return true
    if (!targetSiteId) return true
    if (!siteId) return false
    
    return siteId === targetSiteId
}

/**
 * Validate site access and return error response if denied
 * @returns null if access allowed, error message if denied
 */
export function validateSiteAccess(
    session: Session | null,
    resource: string,
    targetSiteId: string | null | undefined
): string | null {
    if (!canAccessSite(session, resource, targetSiteId)) {
        return `Unauthorized: You can only access ${resource} from your assigned site.`
    }
    return null
}

/**
 * Build Prisma where clause for site filtering
 */
export function buildSiteWhereClause(
    session: Session | null,
    resource: string,
    siteField: string = 'siteId'
): Record<string, string> | undefined {
    const siteId = getSiteFilter(session, resource)
    if (!siteId) return undefined
    
    return { [siteField]: siteId }
}
