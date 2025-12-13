'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import type { PermissionMatrix, FeaturePermission } from '@/lib/types/permissions'
import { ADMIN_MENU_CONFIG, toPermissionMenuFormat, type MenuConfig } from '@/lib/menu-config'

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
 * Helper: Flatten menu definitions for permission matrix
 */
function flattenMenuDefinitions(menus: MenuDefinition[]): MenuDefinition[] {
    const result: MenuDefinition[] = []
    for (const menu of menus) {
        const { children, ...rest } = menu
        result.push(rest as MenuDefinition)
        if (children && children.length > 0) {
            result.push(...flattenMenuDefinitions(children))
        }
    }
    return result
}

/**
 * Hook to get menu definitions from shared config
 * 
 * Uses lib/menu-config.ts as single source of truth
 * No API call needed - menus are loaded synchronously
 */
export function useMenuDefinitions(portal?: string): UseMenuDefinitionsResult {
    // Use shared config - no API call needed
    const menus = useMemo(() => {
        if (portal === 'admin' || !portal) {
            return toPermissionMenuFormat(ADMIN_MENU_CONFIG)
        }
        // For other portals, return empty (can be extended later)
        return []
    }, [portal])

    const flatMenus = useMemo(() => {
        return flattenMenuDefinitions(menus as MenuDefinition[])
    }, [menus])

    // Refetch is a no-op since we're using static config
    const refetch = useCallback(async () => {
        // No-op - config is static
    }, [])

    return {
        menus: menus as MenuDefinition[],
        flatMenus,
        isLoading: false, // Always false since config is synchronous
        error: null,
        refetch,
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
