'use client'

import { useSession } from 'next-auth/react'
import { useCallback } from 'react'

export function usePermission() {
    const { data: session, status } = useSession()
    const isLoading = status === 'loading'
    const isAuthenticated = status === 'authenticated'

    const hasPermission = useCallback((requiredPermission: string) => {
        if (!session?.user) return false

        // Super Admin bypass
        if (session.user.role === 'SUPER_ADMIN') return true

        const permissions = session.user.permissions || []
        return permissions.includes(requiredPermission)
    }, [session])

    const hasAnyPermission = useCallback((requiredPermissions: string[]) => {
        if (!session?.user) return false
        if (session.user.role === 'SUPER_ADMIN') return true

        const permissions = session.user.permissions || []
        return requiredPermissions.some(p => permissions.includes(p))
    }, [session])

    return {
        hasPermission,
        hasAnyPermission,
        isLoading,
        isAuthenticated,
        user: session?.user,
        role: session?.user?.role
    }
}
