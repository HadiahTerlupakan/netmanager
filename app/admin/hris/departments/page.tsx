'use client'

import { useState, useEffect } from 'react'
import {
    HiOutlinePlus,
    HiOutlineBuildingOffice,
    HiOutlineCog,
    HiUsers,
    HiOutlineShieldCheck,
    HiOutlineUserGroup
} from 'react-icons/hi2'

import DepartmentModal from '@/components/departments/DepartmentModal'
import type { DepartmentWithRoles } from '@/lib/repositories/DepartmentRepository'

export default function DepartmentsPage() {
    const [departments, setDepartments] = useState<DepartmentWithRoles[]>([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [editingDept, setEditingDept] = useState<DepartmentWithRoles | null>(null)
    const [stats, setStats] = useState({
        totalDepartments: 0,
        totalEmployees: 0
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
                    totalEmployees: depts.reduce((sum: number, dept: any) => sum + dept._count.employees, 0)
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

    const StatCard = ({ icon: Icon, value, label, color }: { icon: any, value: number, label: string, color: string }) => {
        const colorStyles: Record<string, string> = {
            indigo: 'from-indigo-500 to-purple-500 shadow-indigo-200 dark:shadow-indigo-900/50',
            blue: 'from-blue-500 to-cyan-500 shadow-blue-200 dark:shadow-blue-900/50',
            green: 'from-emerald-500 to-teal-500 shadow-emerald-200 dark:shadow-emerald-900/50',
            purple: 'from-purple-500 to-pink-500 shadow-purple-200 dark:shadow-purple-900/50',
        }

        return (
            <div className="relative overflow-hidden bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5 hover:shadow-lg transition-all duration-200">
                <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${colorStyles[color]} flex items-center justify-center shadow-lg`}>
                        <Icon className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
                    </div>
                </div>
                {/* Subtle decorative element */}
                <div className={`absolute -right-4 -bottom-4 w-24 h-24 rounded-full bg-gradient-to-br ${colorStyles[color]} opacity-5`}></div>
            </div>
        )
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-200 dark:shadow-indigo-900/50">
                            <HiOutlineBuildingOffice className="w-5 h-5 text-white" />
                        </div>
                        Departments
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 ml-[52px]">
                        Kelola departemen dan atur akses permission untuk setiap karyawan
                    </p>
                </div>
                <button
                    onClick={openModal}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-medium rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg shadow-indigo-200 dark:shadow-indigo-900/50 hover:shadow-xl"
                >
                    <HiOutlinePlus className="w-5 h-5" />
                    Tambah Department
                </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <StatCard
                    icon={HiOutlineBuildingOffice}
                    value={stats.totalDepartments}
                    label="Departments"
                    color="indigo"
                />
                <StatCard
                    icon={HiUsers}
                    value={stats.totalEmployees}
                    label="Total Karyawan"
                    color="blue"
                />
            </div>

            {/* Departments Table */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
                {loading ? (
                    <div className="p-8 space-y-4">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="flex items-center gap-4 animate-pulse">
                                <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
                                <div className="flex-1 space-y-2">
                                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
                                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : departments.length === 0 ? (
                    <div className="flex flex-col items-center justify-center min-h-[400px] border-dashed border-gray-300 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 text-center p-8 m-4 rounded-xl border-2">
                        <div className="w-20 h-20 rounded-2xl bg-white dark:bg-gray-800 shadow-sm border border-gray-100 dark:border-gray-700 flex items-center justify-center mb-4">
                            <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center">
                                <HiOutlineBuildingOffice className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                            </div>
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Belum Ada Department</h3>
                        <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-sm">
                            Mulai dengan membuat department pertama untuk mengatur struktur organisasi dan hak akses karyawan
                        </p>
                        <button
                            onClick={openModal}
                            className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 dark:shadow-indigo-900/50 hover:-translate-y-0.5"
                        >
                            <HiOutlinePlus className="w-5 h-5" />
                            Buat Department Baru
                        </button>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        Department
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        Total Karyawan
                                    </th>
                                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {departments.map((dept) => (
                                    <tr
                                        key={dept.id}
                                        className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group"
                                    >
                                        <td className="px-6 py-4">
                                            <div className="flex items-start gap-4">
                                                <div className="flex-shrink-0 w-10 h-10 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                                                    <HiOutlineBuildingOffice className="w-5 h-5" />
                                                </div>
                                                <div>
                                                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                                                        {dept.name}
                                                    </h3>
                                                    {dept.description && (
                                                        <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-1 mt-0.5">
                                                            {dept.description}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg text-sm font-medium">
                                                <HiUsers className="w-4 h-4" />
                                                {dept._count.employees} Karyawan
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => {
                                                        setEditingDept(dept)
                                                        setShowModal(true)
                                                    }}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 text-xs font-medium rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors"
                                                >
                                                    Kelola
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteDepartment(dept.id, dept.name)}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs font-medium rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
                                                >
                                                    Hapus
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

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
