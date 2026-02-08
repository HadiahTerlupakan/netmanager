import type { Session } from 'next-auth'
import { isSuperAdmin } from '@/lib/auth'

/**
 * Site Restriction Service (Multi-Site Support)
 * 
 * Bagian dari modul Roles - mengatur akses berbasis Site.
 * 
 * Logika site_only permission:
 * - Jika role MEMILIKI `resource:site_only` → User dibatasi ke site mereka
 * - Jika role TIDAK MEMILIKI `resource:site_only` → User bisa lihat semua site
 * - SUPER_ADMIN selalu bypass (bisa lihat semua)
 * 
 * Multi-Site Support:
 * - User dapat memiliki multiple sites melalui userSites relation
 * - Primary site digunakan untuk default behavior (attendance, dll)
 * - Untuk filtering, gunakan siteIds array dengan Prisma `{ in: siteIds }`
 * 
 * Penggunaan:
 * ```typescript
 * import { getSiteFilter, canAccessSite, checkSiteRestriction } from '@/modules/roles'
 * 
 * // Di API route GET (list) - Multi-site support
 * const { siteIds, isRestricted } = checkSiteRestriction(session, 'users')
 * if (isRestricted && siteIds?.length) {
 *   where.siteId = { in: siteIds }
 * }
 * 
 * // Di API route GET/PUT/DELETE (single item)
 * if (!canAccessSite(session, 'users', targetUser.siteId)) {
 *   return NextResponse.json({ error: 'Access denied' }, { status: 403 })
 * }
 * ```
 */

export interface SiteRestrictionResult {
    isRestricted: boolean
    /** @deprecated Use siteIds instead for multi-site support */
    siteId: string | undefined
    /** Array of site IDs for multi-site filtering */
    siteIds: string[]
    /** @deprecated Use primarySiteId instead */
    userSiteId: string | null
    /** Primary site ID for default behavior */
    primarySiteId: string | null
}

interface SessionUser {
    id: string
    role?: string
    permissions?: string[]
    /** @deprecated Legacy single site - use siteIds */
    siteId?: string | null
    /** Multi-site: Array of site IDs */
    siteIds?: string[]
    /** Multi-site: Primary site ID */
    primarySiteId?: string | null
}

/**
 * Check site restriction status for a user and resource
 * @param session - NextAuth session
 * @param resource - Resource name (e.g., 'users', 'list', 'attendance')
 * @returns Object with restriction status and site filters
 */
export function checkSiteRestriction(
    session: Session | null,
    resource: string
): SiteRestrictionResult {
    if (!session?.user) {
        return { 
            isRestricted: false, 
            siteId: undefined, 
            siteIds: [],
            userSiteId: null,
            primarySiteId: null 
        }
    }

    const user = session.user as SessionUser
    const permissions = user.permissions || []
    const role = user.role
    
    // Multi-site support: Use siteIds if available, fallback to legacy siteId
    const siteIds = user.siteIds || (user.siteId ? [user.siteId] : [])
    const primarySiteId = user.primarySiteId || user.siteId || null
    const legacySiteId = user.siteId || null

    // SUPER_ADMIN bypass - always can see all
    if (isSuperAdmin(user as any)) {
        return {
            isRestricted: false,
            siteId: undefined,
            siteIds: [],
            userSiteId: legacySiteId,
            primarySiteId
        }
    }

    // Check for site_only permission
    const siteOnlyPermission = `${resource}:site_only`
    const isRestricted = permissions.includes(siteOnlyPermission)

    if (isRestricted) {
        return {
            isRestricted: true,
            siteId: primarySiteId || undefined, // Legacy: use primary for backward compat
            siteIds,
            userSiteId: legacySiteId,
            primarySiteId
        }
    }

    return { 
        isRestricted: false, 
        siteId: undefined, 
        siteIds: [],
        userSiteId: legacySiteId,
        primarySiteId 
    }
}

/**
 * Get site filter for query (shorthand)
 * @deprecated Use getSiteFilters for multi-site support
 * @returns siteId if restricted, undefined if can see all
 */
export function getSiteFilter(
    session: Session | null,
    resource: string
): string | undefined {
    return checkSiteRestriction(session, resource).siteId
}

/**
 * Get site filters for multi-site support
 * @returns Array of siteIds if restricted, empty array if can see all
 */
export function getSiteFilters(
    session: Session | null,
    resource: string
): string[] {
    const result = checkSiteRestriction(session, resource)
    return result.isRestricted ? result.siteIds : []
}

/**
 * Build Prisma where clause for multi-site filtering
 * @returns Prisma where clause with { siteId: { in: siteIds } } or undefined
 */
export function buildMultiSiteWhereClause(
    session: Session | null,
    resource: string,
    siteField: string = 'siteId'
): Record<string, { in: string[] }> | undefined {
    const siteIds = getSiteFilters(session, resource)
    if (siteIds.length === 0) return undefined
    
    return { [siteField]: { in: siteIds } }
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
    const { isRestricted, siteIds } = checkSiteRestriction(session, resource)
    
    if (!isRestricted) return true
    if (!targetSiteId) return true // Allow access if target has no site
    if (siteIds.length === 0) return false
    
    // Multi-site: check if targetSiteId is in user's siteIds
    return siteIds.includes(targetSiteId)
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
        return `Unauthorized: You can only access ${resource} from your assigned sites.`
    }
    return null
}

/**
 * Build Prisma where clause for site filtering
 * @deprecated Use buildMultiSiteWhereClause for multi-site support
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

/**
 * Get user's primary site ID
 * Used for default behavior like attendance location
 */
export function getPrimarySiteId(
    session: Session | null
): string | null {
    if (!session?.user) return null
    const user = session.user as SessionUser
    return user.primarySiteId || user.siteId || null
}

/**
 * Get all user's site IDs
 */
export function getUserSiteIds(
    session: Session | null
): string[] {
    if (!session?.user) return []
    const user = session.user as SessionUser
    return user.siteIds || (user.siteId ? [user.siteId] : [])
}
