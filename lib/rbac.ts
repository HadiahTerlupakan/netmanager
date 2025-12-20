import { authConfig } from '@/lib/auth'
import { getServerSession } from 'next-auth'

export async function hasPermission(requiredPermission: string): Promise<boolean> {
    const session = await getServerSession(authConfig)

    if (!session?.user) {
        return false
    }

    // Super Admin bypass
    if (session.user.role === 'SUPER_ADMIN') {
        return true
    }

    const permissions = session.user.permissions || []
    return permissions.includes(requiredPermission)
}

export async function hasAnyPermission(requiredPermissions: string[]): Promise<boolean> {
    const session = await getServerSession(authConfig)
    if (!session?.user) return false
    if (session.user.role === 'SUPER_ADMIN') return true

    const permissions = session.user.permissions || []
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
