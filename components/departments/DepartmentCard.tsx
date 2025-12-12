'use client'

import { useState } from 'react'
import {
    HiOutlineBuildingOffice,
    HiOutlineUsers,
    HiOutlinePencil,
    HiOutlineTrash,
    HiOutlineShieldCheck,
    HiOutlineCog,
    HiOutlineChevronDown,
    HiOutlineChevronUp
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

export default function DepartmentCard({
    department,
    onEdit,
    onDelete,
    onManageRoles
}: DepartmentCardProps) {
    const [showAllFeatures, setShowAllFeatures] = useState(false)

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

    const VISIBLE_FEATURES = 4
    const hasMoreFeatures = departmentFeatures.length > VISIBLE_FEATURES
    const visibleFeatures = showAllFeatures ? departmentFeatures : departmentFeatures.slice(0, VISIBLE_FEATURES)

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-600 hover:shadow-lg transition-all duration-200 overflow-hidden">
            {/* Header with Gradient */}
            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 p-5">
                <div className="flex items-start gap-4">
                    {/* Department Icon */}
                    <div className="flex-shrink-0 w-12 h-12 bg-white dark:bg-gray-800 rounded-xl shadow-sm flex items-center justify-center border border-gray-200 dark:border-gray-600">
                        <HiOutlineBuildingOffice className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                    </div>

                    <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                            {department.name}
                        </h3>
                        {department.description && (
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5 line-clamp-2">
                                {department.description}
                            </p>
                        )}
                    </div>
                </div>

                {/* Quick Stats Row */}
                <div className="flex items-center gap-4 mt-4">
                    <div className="flex items-center gap-1.5 text-sm">
                        <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                            <HiOutlineUsers className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        </div>
                        <span className="text-gray-700 dark:text-gray-300 font-medium">{department._count.employees}</span>
                        <span className="text-gray-500 dark:text-gray-400 text-xs">karyawan</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-sm">
                        <div className="w-7 h-7 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                            <HiOutlineShieldCheck className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                        </div>
                        <span className="text-gray-700 dark:text-gray-300 font-medium">{activeRoles.length}</span>
                        <span className="text-gray-500 dark:text-gray-400 text-xs">roles</span>
                    </div>
                    {totalRoleAssignments > 0 && (
                        <div className="flex items-center gap-1.5 text-sm">
                            <div className="w-7 h-7 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                                <HiOutlineCog className="w-4 h-4 text-green-600 dark:text-green-400" />
                            </div>
                            <span className="text-gray-700 dark:text-gray-300 font-medium">{totalRoleAssignments}</span>
                            <span className="text-gray-500 dark:text-gray-400 text-xs">assigned</span>
                        </div>
                    )}
                </div>
            </div>



            {/* Actions */}
            <div className="px-5 pb-5 pt-2 flex items-center gap-2 border-t border-gray-100 dark:border-gray-700/50">
                <button
                    onClick={() => onManageRoles(department)}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-medium rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all shadow-sm"
                >
                    <HiOutlineShieldCheck className="w-4 h-4" />
                    Kelola Roles
                </button>
                <button
                    onClick={() => onEdit(department)}
                    className="inline-flex items-center justify-center p-2.5 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    title="Edit Department"
                >
                    <HiOutlinePencil className="w-4 h-4" />
                </button>
                <button
                    onClick={() => onDelete(department.id, department.name)}
                    className="inline-flex items-center justify-center p-2.5 border border-red-200 dark:border-red-800/50 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    title="Delete Department"
                >
                    <HiOutlineTrash className="w-4 h-4" />
                </button>
            </div>
        </div>
    )
}