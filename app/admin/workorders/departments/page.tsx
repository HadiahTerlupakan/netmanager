'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { HiOutlineBuildingOffice2, HiOutlinePlus, HiOutlinePencil, HiOutlineTrash, HiOutlineMagnifyingGlass, HiOutlineUserGroup } from 'react-icons/hi2'

interface Department {
    id: string
    name: string
    description: string | null
    jobDescription: string | null
    createdAt: string
    updatedAt: string
    _count?: {
        employees: number
        workOrders: number
    }
}

export default function DepartmentsPage() {
    const [departments, setDepartments] = useState<Department[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [search, setSearch] = useState('')

    useEffect(() => {
        fetchDepartments()
    }, [search])

    const fetchDepartments = async () => {
        try {
            setLoading(true)
            const params = new URLSearchParams()
            if (search) params.append('search', search)

            const response = await fetch(`/api/admin/departments?${params}`)
            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error || 'Gagal memuat data departments')
            }

            setDepartments(data.data || [])
        } catch (error) {
            console.error('Failed to fetch departments:', error)
            setError(error instanceof Error ? error.message : 'Gagal memuat data')
        } finally {
            setLoading(false)
        }
    }

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`Apakah Anda yakin ingin menghapus department "${name}"?`)) {
            return
        }

        try {
            const response = await fetch(`/api/admin/departments/${id}`, {
                method: 'DELETE',
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error || 'Gagal menghapus department')
            }

            // Refresh data
            fetchDepartments()
        } catch (error) {
            console.error('Failed to delete department:', error)
            alert(error instanceof Error ? error.message : 'Gagal menghapus department')
        }
    }

    if (loading && departments.length === 0) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
                    <p className="mt-2 text-gray-600 dark:text-gray-400">Memuat data departments...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                        Manajemen Departments
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        Kelola departemen untuk Work Orders
                    </p>
                </div>
                <Link
                    href="/admin/workorders/departments/new"
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
                >
                    <HiOutlinePlus className="h-4 w-4 mr-2" />
                    Tambah Department
                </Link>
            </div>

            {/* Search */}
            <div className="relative max-w-md">
                <HiOutlineMagnifyingGlass className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                    type="text"
                    placeholder="Cari berdasarkan nama..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
            </div>

            {error && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-800 dark:text-red-200">
                    {error}
                </div>
            )}

            {/* Departments Table */}
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Daftar Departments ({departments.length})
                    </h2>
                </div>

                {departments.length === 0 ? (
                    <div className="text-center py-12">
                        <HiOutlineBuildingOffice2 className="mx-auto h-12 w-12 text-gray-400" />
                        <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">Belum ada department</h3>
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                            Mulai dengan menambah department pertama Anda.
                        </p>
                        <div className="mt-6">
                            <Link
                                href="/admin/workorders/departments/new"
                                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                            >
                                <HiOutlinePlus className="h-4 w-4 mr-2" />
                                Tambah Department
                            </Link>
                        </div>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                            <thead className="bg-gray-50 dark:bg-gray-900">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                        Nama Department
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                        Deskripsi
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                        Job Description
                                    </th>
                                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                        Employees
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                        Aksi
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                {departments.map((dept) => (
                                    <tr key={dept.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                                                    <HiOutlineBuildingOffice2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                                                </div>
                                                <div className="text-sm font-medium text-gray-900 dark:text-white">
                                                    {dept.name}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm text-gray-500 dark:text-gray-400 max-w-xs truncate">
                                                {dept.description || '-'}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm text-gray-500 dark:text-gray-400 max-w-xs truncate">
                                                {dept.jobDescription || '-'}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className="inline-flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
                                                <HiOutlineUserGroup className="h-4 w-4" />
                                                {dept._count?.employees || 0}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <div className="flex justify-end gap-2">
                                                <Link
                                                    href={`/admin/workorders/departments/${dept.id}/edit`}
                                                    className="p-2 text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
                                                    title="Edit"
                                                >
                                                    <HiOutlinePencil className="h-4 w-4" />
                                                </Link>
                                                <button
                                                    onClick={() => handleDelete(dept.id, dept.name)}
                                                    className="p-2 text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                                    title="Hapus"
                                                >
                                                    <HiOutlineTrash className="h-4 w-4" />
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
        </div>
    )
}
