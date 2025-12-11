'use client'

import {
    HiOutlineBuildingOffice,
    HiOutlineUsers,
    HiOutlinePencil,
    HiOutlineTrash,
    HiOutlineShieldCheck,
    HiOutlineCog,
    HiPlus
} from 'react-icons/hi2'

interface DepartmentWithRoles {
    id: string
    name: string
    description: string | null
    jobDescription: string | null
    allowedFeatures: string | null
    createdAt: Date
    updatedAt: Date
    _count: {
        employees: number
    }
    roles: Array<{
        id: string
        name: string
        code: string
        priority: number
        allowedFeatures: string | null
        isActive: boolean
        _count: {
            employeeRoles: number
        }
    }>
}

interface DepartmentCardProps {
    department: DepartmentWithRoles
    onEdit: (dept: DepartmentWithRoles) => void
    onDelete: (id: string, name: string) => void
    onManageRoles: (dept: DepartmentWithRoles) => void
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

export default function DepartmentCard({
    department,
    onEdit,
    onDelete,
    onManageRoles
}: DepartmentCardProps) {
    const parseFeatures = (featuresJson: string | null): string[] => {
        try {
            return featuresJson ? JSON.parse(featuresJson) : []
        } catch (e) {
            return []
        }
    }

    const departmentFeatures = parseFeatures(department.allowedFeatures)
    const activeRoles = department.roles.filter(r => r.isActive)
    const totalRoleAssignments = activeRoles.reduce((sum, role) => sum + role._count.employeeRoles, 0)

    const getPriorityColor = (priority: number): string => {
        if (priority >= 76) return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
        if (priority >= 26) return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
        return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
    }

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-all overflow-hidden group">
            {/* Card Header */}
            <div className="p-6 border-b border-gray-100 dark:border-gray-700">
                <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
                            <HiOutlineBuildingOffice className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                            {department.name}
                        </h3>
                        {department.description && (
                            <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
                                {department.description}
                            </p>
                        )}
                    </div>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                    <div className="flex items-center gap-1.5">
                        <HiOutlineUsers className="w-4 h-4" />
                        <span>{department._count.employees} employees</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <HiOutlineShieldCheck className="w-4 h-4" />
                        <span>{activeRoles.length} active roles</span>
                    </div>
                    {totalRoleAssignments > 0 && (
                        <div className="flex items-center gap-1.5">
                            <HiOutlineCog className="w-4 h-4" />
                            <span>{totalRoleAssignments} assignments</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Department Base Permissions */}
            <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/20 border-b border-gray-100 dark:border-gray-700">
                <div className="mb-2">
                    <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                        Department Base Permissions
                    </h4>
                    {departmentFeatures.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                            {departmentFeatures.map(feature => {
                                const featureConfig = AVAILABLE_FEATURES.find(f => f.value === feature)
                                return (
                                    <span
                                        key={feature}
                                        className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                                        title="Department Base Permission"
                                    >
                                        <span>{featureConfig?.icon}</span>
                                        {featureConfig?.label || feature}
                                    </span>
                                )
                            })}
                        </div>
                    ) : (
                        <p className="text-xs text-gray-400 dark:text-gray-500 italic">
                            No base permissions set
                        </p>
                    )}
                </div>
            </div>

            {/* Custom Roles */}
            <div className="p-6">
                <div className="mb-3">
                    <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                        Custom Roles
                    </h4>
                    {activeRoles.length > 0 ? (
                        <div className="space-y-2">
                            {activeRoles.slice(0, 3).map(role => (
                                <div key={role.id} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-900/20 rounded-lg">
                                    <div className="flex items-center gap-2">
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(role.priority)}`}>
                                            {role.priority}
                                        </span>
                                        <div>
                                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                                                {role.name}
                                            </div>
                                            <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                                                {role.code}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400">
                                        {role._count.employeeRoles} users
                                    </div>
                                </div>
                            ))}
                            {activeRoles.length > 3 && (
                                <div className="text-center pt-1">
                                    <span className="text-xs text-gray-500 dark:text-gray-400">
                                        +{activeRoles.length - 3} more roles
                                    </span>
                                </div>
                            )}
                        </div>
                    ) : (
                        <p className="text-sm text-gray-400 dark:text-gray-500 italic text-center py-3">
                            No custom roles created yet
                        </p>
                    )}
                </div>
            </div>

            {/* Actions */}
            <div className="px-6 pb-6 flex items-center gap-2">
                <button
                    onClick={() => onManageRoles(department)}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
                >
                    <HiPlus className="w-4 h-4" />
                    Manage Roles
                </button>
                <button
                    onClick={() => onEdit(department)}
                    className="inline-flex items-center justify-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                    <HiOutlinePencil className="w-4 h-4" />
                    Edit
                </button>
                <button
                    onClick={() => onDelete(department.id, department.name)}
                    className="inline-flex items-center justify-center gap-2 px-3 py-2 border border-red-300 dark:border-red-800 rounded-lg text-sm font-medium text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                >
                    <HiOutlineTrash className="w-4 h-4" />
                    Delete
                </button>
            </div>
        </div>
    )
}