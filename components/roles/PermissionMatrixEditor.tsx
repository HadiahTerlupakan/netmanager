'use client'

import React, { useMemo, useCallback } from 'react'
import { HiCheck, HiChevronDown, HiChevronRight } from 'react-icons/hi2'
import type { PermissionMatrix, FeaturePermission } from '@/lib/types/permissions'

interface MenuDefinition {
    code: string
    name: string
    parentCode: string | null
    path: string | null
    icon: string | null
    sortOrder: number
    portal: string
    children?: MenuDefinition[]
}

interface PermissionMatrixEditorProps {
    menus: MenuDefinition[]
    value: PermissionMatrix
    onChange: (matrix: PermissionMatrix) => void
    portal?: string  // Filter by portal
    disabled?: boolean
}

const PERMISSION_ACTIONS = ['read', 'create', 'update', 'delete'] as const

export function PermissionMatrixEditor({
    menus,
    value,
    onChange,
    portal,
    disabled = false,
}: PermissionMatrixEditorProps) {
    const [expandedMenus, setExpandedMenus] = React.useState<Set<string>>(new Set())

    // Filter menus by portal if specified
    const filteredMenus = useMemo(() => {
        if (!portal) return menus
        return menus.filter(m => m.portal === portal)
    }, [menus, portal])

    // Toggle menu expansion
    const toggleExpand = useCallback((code: string) => {
        setExpandedMenus(prev => {
            const newSet = new Set(prev)
            if (newSet.has(code)) {
                newSet.delete(code)
            } else {
                newSet.add(code)
            }
            return newSet
        })
    }, [])

    // Toggle permission for a feature
    const togglePermission = useCallback((
        featureCode: string,
        action: typeof PERMISSION_ACTIONS[number]
    ) => {
        if (disabled) return

        const currentPerms = value[featureCode] || { read: false, create: false, update: false, delete: false }
        const newPerms: FeaturePermission = {
            ...currentPerms,
            [action]: !currentPerms[action],
        }

        // If turning on any non-read permission, also turn on read
        if (action !== 'read' && newPerms[action] && !newPerms.read) {
            newPerms.read = true
        }

        // If turning off read, turn off all permissions
        if (action === 'read' && !newPerms.read) {
            newPerms.create = false
            newPerms.update = false
            newPerms.delete = false
        }

        const newMatrix = { ...value }

        // Check if all permissions are false - if so, remove the entry
        if (!newPerms.read && !newPerms.create && !newPerms.update && !newPerms.delete) {
            delete newMatrix[featureCode]
        } else {
            newMatrix[featureCode] = newPerms
        }

        onChange(newMatrix)
    }, [value, onChange, disabled])

    // Toggle all permissions for a feature
    const toggleAllForFeature = useCallback((featureCode: string, enabled: boolean) => {
        if (disabled) return

        const newMatrix = { ...value }

        if (enabled) {
            newMatrix[featureCode] = { read: true, create: true, update: true, delete: true }
        } else {
            delete newMatrix[featureCode]
        }

        onChange(newMatrix)
    }, [value, onChange, disabled])

    // Check if feature has any permission
    const hasAnyPermission = (featureCode: string): boolean => {
        const perms = value[featureCode]
        if (!perms) return false
        return Boolean(perms.read) || Boolean(perms.create) || Boolean(perms.update) || Boolean(perms.delete)
    }

    // Check if feature has all permissions
    const hasAllPermissions = (featureCode: string): boolean => {
        const perms = value[featureCode]
        if (!perms) return false
        return Boolean(perms.read) && Boolean(perms.create) && Boolean(perms.update) && Boolean(perms.delete)
    }

    // Render a permission checkbox
    const PermissionCheckbox = ({
        featureCode,
        action
    }: {
        featureCode: string
        action: typeof PERMISSION_ACTIONS[number]
    }) => {
        const isChecked = value[featureCode]?.[action] === true

        return (
            <button
                type="button"
                onClick={() => togglePermission(featureCode, action)}
                disabled={disabled}
                className={`
                    w-8 h-8 rounded-md flex items-center justify-center transition-all
                    ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:ring-2 ring-offset-1'}
                    ${isChecked
                        ? 'bg-blue-600 text-white ring-blue-300'
                        : 'bg-gray-100 text-gray-400 hover:bg-gray-200 ring-gray-300'
                    }
                `}
                title={`${action} permission`}
            >
                {isChecked && <HiCheck className="w-4 h-4" />}
            </button>
        )
    }

    // Render a menu row
    const MenuRow = ({
        menu,
        depth = 0
    }: {
        menu: MenuDefinition
        depth?: number
    }) => {
        const hasChildren = menu.children && menu.children.length > 0
        const isExpanded = expandedMenus.has(menu.code)
        const isParentMenu = !menu.parentCode
        const hasPerms = hasAnyPermission(menu.code)
        const hasAll = hasAllPermissions(menu.code)

        return (
            <>
                <tr
                    className={`
                        ${depth === 0 ? 'bg-gray-50' : 'bg-white'}
                        ${hasPerms ? 'border-l-2 border-l-blue-500' : ''}
                        hover:bg-blue-50/50 transition-colors
                    `}
                >
                    {/* Menu Name */}
                    <td className="py-3 px-4">
                        <div
                            className="flex items-center gap-2"
                            style={{ paddingLeft: `${depth * 24}px` }}
                        >
                            {hasChildren ? (
                                <button
                                    type="button"
                                    onClick={() => toggleExpand(menu.code)}
                                    className="p-1 hover:bg-gray-200 rounded"
                                >
                                    {isExpanded ? (
                                        <HiChevronDown className="w-4 h-4 text-gray-500" />
                                    ) : (
                                        <HiChevronRight className="w-4 h-4 text-gray-500" />
                                    )}
                                </button>
                            ) : (
                                <span className="w-6" />
                            )}
                            <span className={`
                                ${isParentMenu ? 'font-medium text-gray-900' : 'text-gray-700'}
                            `}>
                                {menu.name}
                            </span>
                            {menu.path && (
                                <span className="text-xs text-gray-400 font-mono">
                                    {menu.path}
                                </span>
                            )}
                        </div>
                    </td>

                    {/* Select All */}
                    <td className="py-3 px-2 text-center">
                        <button
                            type="button"
                            onClick={() => toggleAllForFeature(menu.code, !hasAll)}
                            disabled={disabled}
                            className={`
                                px-2 py-1 text-xs rounded transition-colors
                                ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}
                                ${hasAll
                                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                                    : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                                }
                            `}
                        >
                            {hasAll ? 'All' : 'None'}
                        </button>
                    </td>

                    {/* Permission Checkboxes */}
                    {PERMISSION_ACTIONS.map(action => (
                        <td key={action} className="py-3 px-2 text-center">
                            <PermissionCheckbox featureCode={menu.code} action={action} />
                        </td>
                    ))}
                </tr>

                {/* Render children */}
                {hasChildren && isExpanded && menu.children!.map(child => (
                    <MenuRow key={child.code} menu={child} depth={depth + 1} />
                ))}
            </>
        )
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full border-collapse">
                <thead>
                    <tr className="bg-gray-100">
                        <th className="py-3 px-4 text-left text-sm font-semibold text-gray-700">
                            Menu
                        </th>
                        <th className="py-3 px-2 text-center text-sm font-semibold text-gray-700 w-16">
                            Semua
                        </th>
                        <th className="py-3 px-2 text-center text-sm font-semibold text-gray-700 w-16">
                            <span className="text-green-600">Baca</span>
                        </th>
                        <th className="py-3 px-2 text-center text-sm font-semibold text-gray-700 w-16">
                            <span className="text-blue-600">Buat</span>
                        </th>
                        <th className="py-3 px-2 text-center text-sm font-semibold text-gray-700 w-16">
                            <span className="text-orange-600">Edit</span>
                        </th>
                        <th className="py-3 px-2 text-center text-sm font-semibold text-gray-700 w-16">
                            <span className="text-red-600">Hapus</span>
                        </th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                    {filteredMenus.map(menu => (
                        <MenuRow key={menu.code} menu={menu} />
                    ))}
                </tbody>
            </table>

            {filteredMenus.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                    Tidak ada menu yang tersedia
                </div>
            )}
        </div>
    )
}

export default PermissionMatrixEditor
