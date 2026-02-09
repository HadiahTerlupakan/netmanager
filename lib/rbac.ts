import { authConfig, getUserPermissions, isSuperAdmin as isSuperAdminHelper } from '@/lib/auth'
import { getServerSession } from 'next-auth'
import type { User } from 'next-auth'
import { hasPermissionWithAlias, expandPermissionsWithAliases } from '@/lib/permission-aliases'

interface ExtendedUser extends User {
    id: string;
    role?: string;
    isSuperAdmin?: boolean;
}

export async function hasPermission(requiredPermission: string, user?: { id?: string; role?: string; isSuperAdmin?: boolean } | null): Promise<boolean> {
    let currentUser = user;
    if (!currentUser) {
        const session = await getServerSession(authConfig)
        currentUser = session?.user as ExtendedUser | null
    }

    if (!currentUser) {
        console.log('[RBAC] No user found in session')
        return false
    }

    // Load permissions from database since session doesn't store them
    // Note: SUPER_ADMIN has all permissions from seed, so no bypass needed
    const userId = currentUser.id
    if (!userId) {
        console.log('[RBAC] No userId found')
        return false
    }

    // Bypass for SUPER_ADMIN to prevent lockout if permissions are missing in DB
    if (isSuperAdminHelper(currentUser)) {
        // console.log('[RBAC] Super Admin bypass for user:', userId)
        return true
    }

    // Debugging non-super admin access
    // console.log('[RBAC] Checking permission for user:', userId, 'Role:', currentUser.role, 'isSuperAdmin:', currentUser.isSuperAdmin)

    const permissions = await getUserPermissions(userId)

    // Check for wildcard permission
    if (permissions.includes('*')) {
        return true
    }

    // Check permission with alias support
    const has = hasPermissionWithAlias(permissions, requiredPermission)

    if (!has) {
        console.log(`[RBAC] Access Denied. User: ${userId}, Role: ${currentUser.role}, Required: ${requiredPermission}, Has: ${permissions.length} perms`)
    }

    return has
}

export async function hasAnyPermission(requiredPermissions: string[], user?: { id?: string; role?: string; isSuperAdmin?: boolean } | null): Promise<boolean> {
    // ... same as before ...
    let currentUser = user;
    if (!currentUser) {
        const session = await getServerSession(authConfig)
        currentUser = session?.user as ExtendedUser | null
    }

    if (!currentUser) return false

    // Load permissions from database since session doesn't store them
    // Note: SUPER_ADMIN has all permissions from seed, so no bypass needed
    const userId = currentUser.id
    if (!userId) {
        return false
    }

    // Bypass for SUPER_ADMIN
    if (isSuperAdminHelper(currentUser)) {
        return true
    }

    const permissions = await getUserPermissions(userId)

    // Check for wildcard permission
    if (permissions.includes('*')) {
        return true
    }

    // Expand required permissions with aliases and check if any match
    const expandedRequired = expandPermissionsWithAliases(requiredPermissions)
    return expandedRequired.some(p => permissions.includes(p))
}

export async function getCurrentUser() {
    const session = await getServerSession(authConfig)
    return session?.user
}

export async function ensurePermission(requiredPermission: string, redirectTo: string = '/admin/forbidden') {
    const session = await getServerSession(authConfig)
    const user = session?.user as ExtendedUser | null

    // Pass user explicitly to avoid double session fetch
    const has = await hasPermission(requiredPermission, user)

    if (!has) {
        // Construct detailed error message for debugging
        const reason = encodeURIComponent(`Missing permission: ${requiredPermission}`)
        const debugInfo = user ? encodeURIComponent(`Role: ${user.role}, IsSuper: ${user.isSuperAdmin}`) : 'NoSession'

        const { redirect } = await import('next/navigation')
        redirect(`${redirectTo}?reason=${reason}&debug=${debugInfo}`)
    }
}

/**
 * Check if user has ANY of the required permissions
 * Useful for section layouts where user needs at least one submenu permission
 */
export async function ensureAnyPermission(requiredPermissions: string[], redirectTo: string = '/admin/forbidden') {
    const has = await hasAnyPermission(requiredPermissions)
    if (!has) {
        const { redirect } = await import('next/navigation')
        redirect(redirectTo)
    }
}

