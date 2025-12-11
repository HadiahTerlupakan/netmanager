'use client'

import { useState, useEffect } from 'react'
import {
    HiOutlinePlus,
    HiOutlineBuildingOffice,
    HiOutlineCog,
    HiUsers,
} from 'react-icons/hi2'
import DepartmentCard from '@/components/departments/DepartmentCard'
import DepartmentModal from '@/components/departments/DepartmentModal'
import type { DepartmentWithRoles } from '@/lib/repositories/DepartmentRepository'

export default function DepartmentsPage() {
    const [departments, setDepartments] = useState<DepartmentWithRoles[]>([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [editingDept, setEditingDept] = useState<DepartmentWithRoles | null>(null)
    const [stats, setStats] = useState({
        totalDepartments: 0,
        totalEmployees: 0,
        totalRoles: 0,
        totalAssignments: 0
    })

    useEffect(() => {
        fetchDepartments()
    }, [])

    const fetchDepartments = async () => {
        try {
            setLoading(true)
            const res = await fetch('/api/hris/departments?includeRoles=true')
            const data = await res.json()
            if (res.ok) {
                setDepartments(data.departments || [])

                // Calculate stats
                const depts = data.departments || []
                setStats({
                    totalDepartments: depts.length,
                    totalEmployees: depts.reduce((sum: number, dept: any) => sum + dept._count.employees, 0),
                    totalRoles: depts.reduce((sum: number, dept: any) => sum + dept.roles.length, 0),
                    totalAssignments: depts.reduce((sum: number, dept: any) =>
                        sum + dept.roles.reduce((roleSum: number, role: any) => roleSum + role._count.employeeRoles, 0), 0)
                })
            }
        } catch (error) {
            console.error('Error fetching departments:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleSaveDepartment = async (data: any) => {
        try {
            const url = editingDept
                ? `/api/hris/departments/${editingDept.id}`
                : '/api/hris/departments'

            const res = await fetch(url, {
                method: editingDept ? 'PATCH' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            })

            if (!res.ok) {
                const errorData = await res.json()
                throw new Error(errorData.error || 'Failed to save department')
            }

            await fetchDepartments()
            alert(editingDept ? 'Department updated successfully!' : 'Department created successfully!')
        } catch (error: any) {
            alert(error.message || 'Failed to save department')
            throw error
        }
    }

    const handleCreateRole = async (data: any) => {
        if (!editingDept) return

        try {
            const res = await fetch(`/api/hris/departments/${editingDept.id}/roles`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            })

            if (!res.ok) {
                const errorData = await res.json()
                throw new Error(errorData.error || 'Failed to create role')
            }

            alert('Role created successfully!')
        } catch (error: any) {
            alert(error.message || 'Failed to create role')
            throw error
        }
    }

    const handleUpdateRole = async (roleId: string, data: any) => {
        if (!editingDept) return

        try {
            const res = await fetch(`/api/hris/departments/${editingDept.id}/roles/${roleId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            })

            if (!res.ok) {
                const errorData = await res.json()
                throw new Error(errorData.error || 'Failed to update role')
            }

            alert('Role updated successfully!')
        } catch (error: any) {
            alert(error.message || 'Failed to update role')
            throw error
        }
    }

    const handleDeleteRole = async (roleId: string, roleName: string, assignmentCount: number) => {
        if (assignmentCount > 0) {
            alert(`Cannot delete role "${roleName}": ${assignmentCount} employee(s) have this role assigned. Please remove all assignments first.`)
            return
        }

        if (!confirm(`Are you sure you want to delete role "${roleName}"?`)) return

        if (!editingDept) return

        try {
            const res = await fetch(`/api/hris/departments/${editingDept.id}/roles/${roleId}`, {
                method: 'DELETE',
            })

            if (!res.ok) {
                const errorData = await res.json()
                throw new Error(errorData.error || 'Failed to delete role')
            }

            alert('Role deleted successfully!')
        } catch (error: any) {
            alert(error.message || 'Failed to delete role')
            throw error
        }
    }

    const handleDeleteDepartment = async (id: string, name: string) => {
        if (!confirm(`Are you sure you want to delete "${name}"? This action cannot be undone.`)) return

        try {
            const res = await fetch(`/api/hris/departments/${id}`, {
                method: 'DELETE',
            })

            if (!res.ok) {
                const errorData = await res.json()
                throw new Error(errorData.error || 'Failed to delete department')
            }

            await fetchDepartments()
            alert('Department deleted successfully!')
        } catch (error: any) {
            alert(error.message || 'Failed to delete department')
        }
    }

    const openModal = () => {
        setEditingDept(null)
        setShowModal(true)
    }

    const closeModal = () => {
        setShowModal(false)
        setEditingDept(null)
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <HiOutlineBuildingOffice className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
                        Departments & Roles
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Manage departments and their custom roles for granular access control
                    </p>
                </div>
                <button
                    onClick={openModal}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-all shadow-sm hover:shadow-md"
                >
                    <HiOutlinePlus className="w-5 h-5" />
                    Add Department
                </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                            <HiOutlineBuildingOffice className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalDepartments}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Departments</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                            <HiUsers className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalEmployees}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Total Employees</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                            <HiOutlineCog className="w-5 h-5 text-green-600 dark:text-green-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalRoles}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Custom Roles</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                            <HiOutlineCog className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalAssignments}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Role Assignments</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Departments Grid */}
            {loading ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 animate-pulse">
                            <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-4"></div>
                            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full mb-2"></div>
                            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
                        </div>
                    ))}
                </div>
            ) : departments.length === 0 ? (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
                    <HiOutlineBuildingOffice className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Departments Yet</h3>
                    <p className="text-gray-500 dark:text-gray-400 mb-6">
                        Get started by creating your first department and defining its access permissions
                    </p>
                    <button
                        onClick={openModal}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                        <HiOutlinePlus className="w-5 h-5" />
                        Create Department
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                    {departments.map((dept) => (
                        <DepartmentCard
                            key={dept.id}
                            department={dept}
                            onEdit={(dept) => {
                                setEditingDept(dept)
                                setShowModal(true)
                            }}
                            onDelete={handleDeleteDepartment}
                            onManageRoles={(dept) => {
                                setEditingDept(dept)
                                setShowModal(true)
                            }}
                        />
                    ))}
                </div>
            )}

            {/* Department Modal */}
            <DepartmentModal
                isOpen={showModal}
                onClose={closeModal}
                department={editingDept}
                onSave={handleSaveDepartment}
                onCreateRole={handleCreateRole}
                onUpdateRole={handleUpdateRole}
                onDeleteRole={handleDeleteRole}
            />
        </div>
    )
}
