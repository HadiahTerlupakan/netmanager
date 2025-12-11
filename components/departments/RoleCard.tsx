'use client'

import {
    HiOutlinePencil,
    HiOutlineTrash,
    HiOutlineUsers,
    HiOutlineCheckCircle,
    HiOutlineXCircle,
    HiOutlineShieldCheck
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
    { value: 'DASHBOARD', label: 'Dashboard', icon: '📊', color: 'slate' },
    { value: 'ROLES', label: 'Roles Management', icon: '🛡️', color: 'purple' },
    { value: 'NETWORK', label: 'Network Management', icon: '🔌', color: 'indigo' },
    { value: 'FTTH', label: 'FTTH Infrastructure', icon: '🌐', color: 'cyan' },
    { value: 'PAKET', label: 'Paket & Bandwidth', icon: '📦', color: 'teal' },
    { value: 'PELANGGAN', label: 'Customer Management', icon: '👤', color: 'purple' },
    { value: 'INVENTORY', label: 'Inventory', icon: '📦', color: 'lime' },
    { value: 'USERS', label: 'User Management', icon: '👥', color: 'sky' },
    { value: 'HELPDESK', label: 'Helpdesk & Support', icon: '🎫', color: 'orange' },
    { value: 'WORKORDERS', label: 'Work Orders', icon: '🔧', color: 'amber' },
    { value: 'HRIS', label: 'HR & Payroll', icon: '👥', color: 'blue' },
    { value: 'FINANCE', label: 'Finance & Billing', icon: '💰', color: 'emerald' },
    { value: 'PENGATURAN', label: 'Settings', icon: '⚙️', color: 'gray' },
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

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:shadow-md transition-all">
            {/* Role Header */}
            <div className="p-4 border-b border-gray-100 dark:border-gray-700">
                <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                        <h3 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                            <HiOutlineShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                            {role.name}
                        </h3>
                        <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                            {role.code}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {role.isActive ? (
                            <span className="inline-flex items-center gap-1 text-xs text-green-700 dark:text-green-400">
                                <HiOutlineCheckCircle className="w-4 h-4" />
                                Active
                            </span>
                        ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                                <HiOutlineXCircle className="w-4 h-4" />
                                Inactive
                            </span>
                        )}
                    </div>
                </div>

                {role.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                        {role.description}
                    </p>
                )}

                <div className="flex items-center gap-3 mt-2 text-xs text-gray-500 dark:text-gray-400">
                    <div className="flex items-center gap-1">
                        <HiOutlineUsers className="w-4 h-4" />
                        <span>{role._count.employeeRoles} assigned</span>
                    </div>
                </div>
            </div>

            {/* Permission Changes */}
            <div className="p-4">
                <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                    Permission Changes
                </h4>

                {addedFeatures.length === 0 && removedFeatures.length === 0 ? (
                    <p className="text-sm text-gray-400 dark:text-gray-500 italic">
                        Inherits all department permissions
                    </p>
                ) : (
                    <div className="space-y-2">
                        {addedFeatures.length > 0 && (
                            <div>
                                <span className="text-xs font-medium text-green-700 dark:text-green-400 mb-1 block">
                                    + Added Features
                                </span>
                                <div className="flex flex-wrap gap-1">
                                    {addedFeatures.map(feature => {
                                        const featureConfig = AVAILABLE_FEATURES.find(f => f.value === feature)
                                        return (
                                            <span
                                                key={feature}
                                                className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 text-xs rounded-full"
                                            >
                                                <span>{featureConfig?.icon}</span>
                                                {featureConfig?.label || feature}
                                            </span>
                                        )
                                    })}
                                </div>
                            </div>
                        )}

                        {removedFeatures.length > 0 && (
                            <div>
                                <span className="text-xs font-medium text-red-700 dark:text-red-400 mb-1 block">
                                    - Removed Features
                                </span>
                                <div className="flex flex-wrap gap-1">
                                    {removedFeatures.map(feature => {
                                        const featureConfig = AVAILABLE_FEATURES.find(f => f.value === feature)
                                        return (
                                            <span
                                                key={feature}
                                                className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 text-xs rounded-full"
                                            >
                                                <span>{featureConfig?.icon}</span>
                                                {featureConfig?.label || feature}
                                            </span>
                                        )
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Current Features Summary */}
                <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">
                        Final Permissions ({roleFeatures.length} total)
                    </span>
                    <div className="flex flex-wrap gap-1">
                        {roleFeatures.slice(0, 4).map(feature => {
                            const featureConfig = AVAILABLE_FEATURES.find(f => f.value === feature)
                            return (
                                <span
                                    key={feature}
                                    className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 text-xs rounded-full"
                                >
                                    <span>{featureConfig?.icon}</span>
                                    {featureConfig?.label || feature}
                                </span>
                            )
                        })}
                        {roleFeatures.length > 4 && (
                            <span className="text-xs text-gray-500 dark:text-gray-400 px-2 py-1">
                                +{roleFeatures.length - 4} more
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Actions */}
            <div className="px-4 pb-4 flex items-center gap-2 pt-3 border-t border-gray-100 dark:border-gray-700">
                <button
                    onClick={() => onEdit(role)}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                    <HiOutlinePencil className="w-4 h-4" />
                    Edit Role
                </button>
                <button
                    onClick={() => onDelete(role.id, role.name, role._count.employeeRoles)}
                    className="inline-flex items-center justify-center gap-2 px-3 py-2 border border-red-300 dark:border-red-800 rounded-lg text-sm font-medium text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                >
                    <HiOutlineTrash className="w-4 h-4" />
                    Delete
                </button>
            </div>
        </div>
    )
}