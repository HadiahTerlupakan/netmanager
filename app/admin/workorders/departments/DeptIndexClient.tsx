'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { HiOutlineBuildingOffice2, HiOutlinePlus, HiOutlineMagnifyingGlass, HiOutlineUserGroup } from 'react-icons/hi2'
import { FiEdit, FiTrash2 } from 'react-icons/fi'
import { ResponsiveTable, type Column } from '@/components/ui/ResponsiveTable'
import { usePermission } from '@/hooks/use-permission'

interface Department {
    id: string
    name: string
    description: string | null
    jobDescription: string | null
    createdAt: string
    updatedAt: string
    _count?: {
        user: number
        workOrders: number
    }
}

export function ClientComponent() {
    const { hasPermission } = usePermission()
    const canCreate = hasPermission('department:create')
    const canUpdate = hasPermission('department:update')
    const canDelete = hasPermission('department:delete')

    const [departments, setDepartments] = useState<Department[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [search, setSearch] = useState('')

    const fetchDepartments = useCallback(async () => {
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
        } catch (error: unknown) {
            console.error('Failed to fetch departments:', error)
            setError(error instanceof Error ? error.message : 'Gagal memuat data')
        } finally {
            setLoading(false)
        }
    }, [search])

    useEffect(() => {
        fetchDepartments()
    }, [fetchDepartments])

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
        } catch (error: unknown) {
            console.error('Failed to delete department:', error)
            alert(error instanceof Error ? error.message : 'Gagal menghapus department')
        }
    }

    const columns: Column<Department>[] = [
        {
            key: 'name',
            header: 'Nama Department',
            priority: 'primary',
            render: (dept) => (
                <div className="flex items-center gap-3">
                    <div className="shrink-0 w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                        <HiOutlineBuildingOffice2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {dept.name}
                    </div>
                </div>
            )
        },
        {
            key: 'description',
            header: 'Deskripsi',
            priority: 'secondary',
            render: (dept) => (
                <div className="text-sm text-gray-500 dark:text-gray-400 max-w-xs truncate">
                    {dept.description || '-'}
                </div>
            )
        },
        {
            key: 'jobDescription',
            header: 'Job Description',
            priority: 'tertiary',
            render: (dept) => (
                <div className="text-sm text-gray-500 dark:text-gray-400 max-w-xs truncate">
                    {dept.jobDescription || '-'}
                </div>
            )
        },
        {
            key: 'employees',
            header: 'Employees',
            priority: 'secondary',
            render: (dept) => (
                <span className="inline-flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 justify-center w-full">
                    <HiOutlineUserGroup className="h-4 w-4" />
                    {dept._count?.user || 0}
                </span>
            )
        }
    ]

    const renderActions = (dept: Department) => (
        <div className="flex items-center justify-center gap-2">
            {canUpdate && (
                <Link
                    href={`/admin/workorders/departments/${dept.id}/edit`}
                    className="p-2 text-indigo-600 hover:text-indigo-900 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:text-indigo-300 dark:hover:bg-indigo-900/20 rounded transition-colors"
                    title="Edit"
                >
                    <FiEdit className="h-4 w-4" />
                </Link>
            )}
            {canDelete && (
                <button
                    onClick={() => handleDelete(dept.id, dept.name)}
                    className="p-2 text-red-600 hover:text-red-900 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/20 rounded transition-colors"
                    title="Hapus"
                >
                    <FiTrash2 className="h-4 w-4" />
                </button>
            )}
        </div>
    )

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
                {canCreate && (
                    <Link
                        href="/admin/workorders/departments/new"
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-indigo-600 dark:bg-indigo-500 hover:bg-indigo-700 dark:hover:bg-indigo-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
                    >
                        <HiOutlinePlus className="h-4 w-4 mr-2 text-white" />
                        <span className="text-white">Tambah Department</span>
                    </Link>
                )}
            </div>

            {/* Search */}
            <div className="relative max-w-md">
                <HiOutlineMagnifyingGlass className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                    type="text"
                    placeholder="Cari berdasarkan nama..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
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

                <ResponsiveTable
                    data={departments}
                    columns={columns}
                    keyField="id"
                    loading={loading && departments.length === 0}
                    loadingMessage="Memuat data departments..."
                    emptyMessage="Belum ada department. Mulai dengan menambah department pertama Anda."
                    renderActions={renderActions}
                />
            </div>
        </div>
    )
}
