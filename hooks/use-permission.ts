'use client'

import { useSession } from 'next-auth/react'
import { useCallback, useEffect, useState } from 'react'

interface PermissionState {
    permissions: string[]
    isSuperAdmin: boolean
    isLoading: boolean
}

export function usePermission() {
    const { data: session, status } = useSession()
    const isAuthLoading = status === 'loading'
    const isAuthenticated = status === 'authenticated'
    
    const [permissionState, setPermissionState] = useState<PermissionState>({
        permissions: [],
        isSuperAdmin: false,
        isLoading: true
    })

    // Fetch permissions from API when session is available
    useEffect(() => {
        if (!isAuthenticated || !session?.user) {
            setPermissionState({ permissions: [], isSuperAdmin: false, isLoading: false })
            return
        }

        // Check if user is super admin from session (quick check)
        const user = session.user as { role?: string }
        if (user.role === 'SUPER_ADMIN' || user.role === 'Super Admin') {
            setPermissionState({ permissions: ['*'], isSuperAdmin: true, isLoading: false })
            return
        }

        // Fetch permissions from API
        const fetchPermissions = async () => {
            try {
                const response = await fetch('/api/user/permissions', {
                    credentials: 'include'
                })
                
                if (!response.ok) {
                    console.error('[usePermission] Failed to fetch permissions:', response.status)
                    setPermissionState({ permissions: [], isSuperAdmin: false, isLoading: false })
                    return
                }

                const data = await response.json()
                setPermissionState({
                    permissions: data.permissions || [],
                    isSuperAdmin: data.isSuperAdmin || false,
                    isLoading: false
                })
            } catch (error) {
                console.error('[usePermission] Error fetching permissions:', error)
                setPermissionState({ permissions: [], isSuperAdmin: false, isLoading: false })
            }
        }

        fetchPermissions()
    }, [isAuthenticated, session])

    const hasPermission = useCallback((requiredPermission: string) => {
        // Super Admin has all permissions
        if (permissionState.isSuperAdmin) return true
        
        return permissionState.permissions.includes(requiredPermission)
    }, [permissionState])

    const hasAnyPermission = useCallback((requiredPermissions: string[]) => {
        // Super Admin has all permissions
        if (permissionState.isSuperAdmin) return true
        
        return requiredPermissions.some(p => permissionState.permissions.includes(p))
    }, [permissionState])

    return {
        hasPermission,
        hasAnyPermission,
        isLoading: isAuthLoading || permissionState.isLoading,
        isAuthenticated,
        user: session?.user,
        role: session?.user?.role,
        permissions: permissionState.permissions,
        isSuperAdmin: permissionState.isSuperAdmin
    }
}
