'use client'

import { useState, useEffect, useCallback } from 'react'
import type { PermissionMatrix, FeaturePermission } from '@/lib/types/permissions'

interface MenuDefinition {
    id: string
    code: string
    name: string
    parentCode: string | null
    path: string | null
    icon: string | null
    sortOrder: number
    portal: string
    children?: MenuDefinition[]
}

interface UseMenuDefinitionsResult {
    menus: MenuDefinition[]
    flatMenus: MenuDefinition[]
    isLoading: boolean
    error: string | null
    refetch: () => Promise<void>
}

/**
 * Hook to fetch menu definitions from API
 */
export function useMenuDefinitions(portal?: string): UseMenuDefinitionsResult {
    const [menus, setMenus] = useState<MenuDefinition[]>([])
    const [flatMenus, setFlatMenus] = useState<MenuDefinition[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const fetchMenus = useCallback(async () => {
        setIsLoading(true)
        setError(null)

        try {
            // Try runtime discovery first (no database needed)
            const discoveryUrl = portal
                ? `/api/menu-discovery?portal=${portal}`
                : '/api/menu-discovery'

            let response = await fetch(discoveryUrl)
            let data = await response.json()

            // If discovery fails, fallback to database
            if (!data.success) {
                const dbUrl = portal
                    ? `/api/menu-definitions?portal=${portal}`
                    : '/api/menu-definitions'
                response = await fetch(dbUrl)
                data = await response.json()
            }

            if (data.success) {
                setMenus(data.data)
                setFlatMenus(data.flat)
            } else {
                throw new Error(data.error || 'Failed to fetch menu definitions')
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error')
        } finally {
            setIsLoading(false)
        }
    }, [portal])

    useEffect(() => {
        fetchMenus()
    }, [fetchMenus])

    return {
        menus,
        flatMenus,
        isLoading,
        error,
        refetch: fetchMenus,
    }
}

interface UsePermissionMatrixResult {
    matrix: PermissionMatrix
    setMatrix: (matrix: PermissionMatrix) => void
    hasPermission: (featureCode: string, action?: keyof FeaturePermission) => boolean
    togglePermission: (featureCode: string, action: keyof FeaturePermission) => void
    setFullAccess: (featureCode: string) => void
    removeAccess: (featureCode: string) => void
    serialize: () => string
}

/**
 * Hook to manage permission matrix state
 */
export function usePermissionMatrix(
    initialMatrix: PermissionMatrix = {}
): UsePermissionMatrixResult {
    const [matrix, setMatrix] = useState<PermissionMatrix>(initialMatrix)

    // Update matrix when initial value changes
    useEffect(() => {
        setMatrix(initialMatrix)
    }, [initialMatrix])

    const hasPermission = useCallback((
        featureCode: string,
        action: keyof FeaturePermission = 'read'
    ): boolean => {
        const perms = matrix[featureCode]
        if (!perms) return false
        return perms[action] === true
    }, [matrix])

    const togglePermission = useCallback((
        featureCode: string,
        action: keyof FeaturePermission
    ) => {
        setMatrix(prev => {
            const currentPerms = prev[featureCode] || {
                read: false,
                create: false,
                update: false,
                delete: false
            }

            const newPerms: FeaturePermission = {
                ...currentPerms,
                [action]: !currentPerms[action],
            }

            // If turning on non-read, also turn on read
            if (action !== 'read' && newPerms[action] && !newPerms.read) {
                newPerms.read = true
            }

            // If turning off read, turn off all
            if (action === 'read' && !newPerms.read) {
                newPerms.create = false
                newPerms.update = false
                newPerms.delete = false
            }

            const newMatrix = { ...prev }

            // Remove if all permissions are false
            if (!newPerms.read && !newPerms.create && !newPerms.update && !newPerms.delete) {
                delete newMatrix[featureCode]
            } else {
                newMatrix[featureCode] = newPerms
            }

            return newMatrix
        })
    }, [])

    const setFullAccess = useCallback((featureCode: string) => {
        setMatrix(prev => ({
            ...prev,
            [featureCode]: { read: true, create: true, update: true, delete: true }
        }))
    }, [])

    const removeAccess = useCallback((featureCode: string) => {
        setMatrix(prev => {
            const newMatrix = { ...prev }
            delete newMatrix[featureCode]
            return newMatrix
        })
    }, [])

    const serialize = useCallback((): string => {
        return JSON.stringify(matrix)
    }, [matrix])

    return {
        matrix,
        setMatrix,
        hasPermission,
        togglePermission,
        setFullAccess,
        removeAccess,
        serialize,
    }
}

/**
 * Parse permission matrix from string (for loading from database)
 */
export function parsePermissionMatrix(allowedFeatures: string | null): PermissionMatrix {
    if (!allowedFeatures) return {}

    try {
        const parsed = JSON.parse(allowedFeatures)

        // Handle legacy array format
        if (Array.isArray(parsed)) {
            const matrix: PermissionMatrix = {}
            parsed.forEach((f: string) => {
                matrix[f] = { read: true, create: true, update: true, delete: true }
            })
            return matrix
        }

        return parsed as PermissionMatrix
    } catch {
        return {}
    }
}

export default useMenuDefinitions
