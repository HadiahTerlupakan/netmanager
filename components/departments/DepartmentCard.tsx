'use client'

import {
    HiOutlineBuildingOffice,
    HiOutlineUsers,
    HiOutlinePencil,
    HiOutlineTrash,
} from 'react-icons/hi2'
import { Button } from '@/components/ui/Button'

interface Department {
    id: string
    name: string
    description: string | null
    jobDescription: string | null
    createdAt: Date
    updatedAt: Date
    _count: {
        user: number
    }
}

interface DepartmentCardProps {
    department: Department
    onEdit: (dept: Department) => void
    onDelete: (id: string, name: string) => void
}

export default function DepartmentCard({
    department,
    onEdit,
    onDelete,
}: DepartmentCardProps) {
    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-600 hover:shadow-lg transition-all duration-200 overflow-hidden">
            {/* Header with Gradient */}
            <div className="bg-linear-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 p-5">
                <div className="flex items-start gap-4">
                    {/* Department Icon */}
                    <div className="shrink-0 w-12 h-12 bg-white dark:bg-gray-800 rounded-xl shadow-sm flex items-center justify-center border border-gray-200 dark:border-gray-600">
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
                        <span className="text-gray-700 dark:text-gray-300 font-medium">{department._count.user}</span>
                        <span className="text-gray-500 dark:text-gray-400 text-xs">karyawan</span>
                    </div>
                </div>
            </div>

            {/* Actions */}
            <div className="px-5 pb-5 pt-2 flex items-center gap-2 border-t border-gray-100 dark:border-gray-700/50">
                <Button
                    onClick={() => onEdit(department)}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2.5 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                    <HiOutlinePencil className="w-4 h-4" />
                    Edit
                </Button>
                <Button
                    onClick={() => onDelete(department.id, department.name)}
                    className="inline-flex items-center justify-center p-2.5 border border-red-200 dark:border-red-800/50 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    title="Delete Department"
                >
                    <HiOutlineTrash className="w-4 h-4" />
                </Button>
            </div>
        </div>
    )
}