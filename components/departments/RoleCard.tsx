'use client'

import {
    HiOutlinePencil,
    HiOutlineTrash,
    HiOutlineUsers,
    HiOutlineCheckCircle,
    HiOutlineXCircle,
} from 'react-icons/hi2'

interface RoleCardProps {
    role: {
        id: string
        name: string
        code: string
        description: string | null
        allowedFeatures: string | null
        isActive: boolean
        _count: {
            employeeRoles: number
        }
    }
    departmentFeatures: string[]
    onEdit: (role: any) => void
    onDelete: (id: string, name: string, assignmentCount: number) => void
}

const AVAILABLE_FEATURES = [
    { value: 'DASHBOARD', label: 'Dashboard', icon: '📊' },
    { value: 'ROLES', label: 'Roles', icon: '🛡️' },
    { value: 'NETWORK', label: 'Network', icon: '🔌' },
    { value: 'FTTH', label: 'FTTH', icon: '🌐' },
    { value: 'PAKET', label: 'Paket', icon: '📦' },
    { value: 'PELANGGAN', label: 'Pelanggan', icon: '👤' },
    { value: 'INVENTORY', label: 'Inventory', icon: '📦' },
    { value: 'USERS', label: 'Users', icon: '👥' },
    { value: 'HELPDESK', label: 'Helpdesk', icon: '🎫' },
    { value: 'WORKORDERS', label: 'Work Orders', icon: '🔧' },
    { value: 'HRIS', label: 'HRIS', icon: '👥' },
    { value: 'FINANCE', label: 'Finance', icon: '💰' },
    { value: 'PENGATURAN', label: 'Pengaturan', icon: '⚙️' },
]

export default function RoleCard({
    role,
    departmentFeatures,
    onEdit,
    onDelete
}: RoleCardProps) {
    const parseFeatures = (featuresJson: string | null): string[] => {
        try {
            return featuresJson ? JSON.parse(featuresJson) : []
        } catch (e) {
            return []
        }
    }

    const roleFeatures = parseFeatures(role.allowedFeatures)

    // Calculate permission changes
    const addedFeatures = roleFeatures.filter(f => !departmentFeatures.includes(f))
    const removedFeatures = departmentFeatures.filter(f => !roleFeatures.includes(f))
    const inheritsAll = addedFeatures.length === 0 && removedFeatures.length === 0

    return (
        <div className={`bg-white dark:bg-gray-800 rounded-xl border transition-all hover:shadow-md ${role.isActive
                ? 'border-gray-200 dark:border-gray-700'
                : 'border-gray-200 dark:border-gray-700 opacity-60'
            }`}>
            {/* Header */}
            <div className="p-4">
                <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <h3 className="text-base font-semibold text-gray-900 dark:text-white truncate">
                                {role.name}
                            </h3>
                            {role.isActive ? (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-medium rounded">
                                    <HiOutlineCheckCircle className="w-3 h-3" />
                                    Aktif
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-500 text-xs font-medium rounded">
                                    <HiOutlineXCircle className="w-3 h-3" />
                                    Nonaktif
                                </span>
                            )}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 font-mono mt-0.5">
                            {role.code}
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5 ml-2">
                        <button
                            onClick={() => onEdit(role)}
                            className="p-1.5 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
                            title="Edit Role"
                        >
                            <HiOutlinePencil className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => onDelete(role.id, role.name, role._count.employeeRoles)}
                            className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            title="Delete Role"
                        >
                            <HiOutlineTrash className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {role.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-3">
                        {role.description}
                    </p>
                )}

                {/* Stats Row */}
                <div className="flex items-center gap-3 text-sm">
                    <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
                        <HiOutlineUsers className="w-4 h-4" />
                        <span className="font-medium">{role._count.employeeRoles}</span>
                        <span className="text-gray-400 dark:text-gray-500">assigned</span>
                    </div>
                    <span className="text-gray-300 dark:text-gray-600">•</span>
                    <span className="text-gray-500 dark:text-gray-400">
                        {roleFeatures.length} permissions
                    </span>
                </div>
            </div>

            {/* Permission Summary */}
            <div className="px-4 pb-4 pt-2 border-t border-gray-100 dark:border-gray-700/50">
                {inheritsAll ? (
                    <div className="text-sm text-gray-500 dark:text-gray-400 italic">
                        ✓ Mewarisi semua permission department
                    </div>
                ) : (
                    <div className="space-y-2">
                        {addedFeatures.length > 0 && (
                            <div className="flex flex-wrap items-center gap-1">
                                <span className="text-xs font-medium text-green-600 dark:text-green-400 mr-1">+</span>
                                {addedFeatures.slice(0, 3).map(feature => {
                                    const featureConfig = AVAILABLE_FEATURES.find(f => f.value === feature)
                                    return (
                                        <span
                                            key={feature}
                                            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 text-xs rounded"
                                        >
                                            {featureConfig?.icon} {featureConfig?.label || feature}
                                        </span>
                                    )
                                })}
                                {addedFeatures.length > 3 && (
                                    <span className="text-xs text-green-600 dark:text-green-400">
                                        +{addedFeatures.length - 3}
                                    </span>
                                )}
                            </div>
                        )}

                        {removedFeatures.length > 0 && (
                            <div className="flex flex-wrap items-center gap-1">
                                <span className="text-xs font-medium text-red-600 dark:text-red-400 mr-1">−</span>
                                {removedFeatures.slice(0, 3).map(feature => {
                                    const featureConfig = AVAILABLE_FEATURES.find(f => f.value === feature)
                                    return (
                                        <span
                                            key={feature}
                                            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-xs rounded line-through"
                                        >
                                            {featureConfig?.icon} {featureConfig?.label || feature}
                                        </span>
                                    )
                                })}
                                {removedFeatures.length > 3 && (
                                    <span className="text-xs text-red-600 dark:text-red-400">
                                        +{removedFeatures.length - 3}
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}