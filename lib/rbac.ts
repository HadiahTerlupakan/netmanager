import { authConfig, getUserPermissions } from '@/lib/auth'
import { getServerSession } from 'next-auth'

export async function hasPermission(requiredPermission: string, user?: { id?: string } | null): Promise<boolean> {
    let currentUser = user;
    if (!currentUser) {
        const session = await getServerSession(authConfig)
        currentUser = session?.user as { id?: string } | null
    }

    if (!currentUser) {
        return false
    }

    // Load permissions from database since session doesn't store them
    // Note: SUPER_ADMIN has all permissions from seed, so no bypass needed
    const userId = currentUser.id
    if (!userId) {
        return false
    }

    const permissions = await getUserPermissions(userId)
    return permissions.includes(requiredPermission)
}

export async function hasAnyPermission(requiredPermissions: string[], user?: { id?: string } | null): Promise<boolean> {
    let currentUser = user;
    if (!currentUser) {
        const session = await getServerSession(authConfig)
        currentUser = session?.user as { id?: string } | null
    }

    if (!currentUser) return false

    // Load permissions from database since session doesn't store them
    // Note: SUPER_ADMIN has all permissions from seed, so no bypass needed
    const userId = currentUser.id
    if (!userId) {
        return false
    }

    const permissions = await getUserPermissions(userId)
    return requiredPermissions.some(p => permissions.includes(p))
}

export async function getCurrentUser() {
    const session = await getServerSession(authConfig)
    return session?.user
}

export async function ensurePermission(requiredPermission: string, redirectTo: string = '/admin') {
    const has = await hasPermission(requiredPermission)
    if (!has) {
        const { redirect } = await import('next/navigation')
        redirect(redirectTo)
    }
}

/**
 * Check if user has ANY of the required permissions
 * Useful for section layouts where user needs at least one submenu permission
 */
export async function ensureAnyPermission(requiredPermissions: string[], redirectTo: string = '/admin') {
    const has = await hasAnyPermission(requiredPermissions)
    if (!has) {
        const { redirect } = await import('next/navigation')
        redirect(redirectTo)
    }
}

