'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePermission } from '@/hooks/use-permission'
import { toast } from 'react-hot-toast'
import { FiPlus, FiEdit2, FiTrash2 } from 'react-icons/fi'
import ResponsiveTable from '@/components/ui/ResponsiveTable'

interface Role {
    id: string
    name: string
    description: string
    _count?: {
        user: number  // Note: 'user' not 'users' - matches Prisma relation name
    }
}

export function ClientComponent() {
    const [roles, setRoles] = useState<Role[]>([])
    const [loading, setLoading] = useState(true)
    const { hasPermission, isLoading: authLoading } = usePermission()

    useEffect(() => {
        fetchRoles()
    }, [])

    const fetchRoles = async () => {
        try {
            const res = await fetch('/api/roles')
            if (res.ok) {
                const data = await res.json()
                setRoles(data)
            } else {
                toast.error('Gagal memuat data role')
            }
        } catch (error) {
            console.error(error)
            toast.error('Terjadi kesalahan')
        } finally {
            setLoading(false)
        }
    }

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`Apakah Anda yakin ingin menghapus role "${name}"?`)) return

        try {
            const res = await fetch(`/api/roles/${id}`, {
                method: 'DELETE',
            })

            const data = await res.json()

            if (!res.ok) {
                throw new Error(data.error || 'Gagal menghapus role')
            }

            toast.success('Role berhasil dihapus')
            fetchRoles()
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Terjadi kesalahan'
            toast.error(message)
        }
    }

    if (authLoading || loading) {
        return <div className="p-8 text-center">Loading...</div>
    }

    if (!hasPermission('roles:read')) {
        return <div className="p-8 text-center text-red-500">Anda tidak memiliki akses ke halaman ini.</div>
    }

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Manajemen Role</h1>
                    <p className="text-gray-600 dark:text-gray-400">Atur hak akses pengguna aplikasi</p>
                </div>
                {hasPermission('roles:create') && (
                    <Link
                        href="/admin/settings/roles/new"
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
                    >
                        <FiPlus /> Tambah Role
                    </Link>
                )}
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                <ResponsiveTable<Role>
                    data={roles}
                    loading={loading}
                    keyField="id"
                    columns={[
                        {
                            key: 'name',
                            header: 'Nama Role',
                            priority: 'primary',
                            render: (item) => <span className="font-medium text-gray-900 dark:text-white">{item.name}</span>
                        },
                        {
                            key: 'description',
                            header: 'Deskripsi',
                            priority: 'primary',
                            render: (item) => <span className="text-gray-500 dark:text-gray-400">{item.description || '-'}</span>
                        },
                        {
                            key: '_count',
                            header: 'Users',
                            priority: 'secondary',
                            align: 'center',
                            render: (item) => (
                                <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 text-xs px-2 py-1 rounded-full">
                                    {item._count?.user || 0} User
                                </span>
                            )
                        }
                    ]}
                    emptyMessage="Belum ada data role."
                    renderActions={(item) => (
                        <div className="flex justify-end gap-2">
                            {hasPermission('roles:update') && (
                                <Link
                                    href={`/admin/settings/roles/${item.id}`}
                                    className="p-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                                    title="Edit Role"
                                >
                                    <FiEdit2 />
                                </Link>
                            )}
                            {hasPermission('roles:delete') && item.name !== 'SUPER_ADMIN' && (
                                <button
                                    onClick={() => handleDelete(item.id, item.name)}
                                    disabled={(item._count?.user || 0) > 0}
                                    className={`p-2 rounded-lg transition-colors ${(item._count?.user || 0) > 0
                                        ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                                        : 'text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20'
                                        }`}
                                    title={(item._count?.user || 0) > 0 ? 'Tidak dapat menghapus role yang memiliki user aktif' : 'Hapus Role'}
                                >
                                    <FiTrash2 />
                                </button>
                            )}
                        </div>
                    )}
                />
            </div>
        </div>
    )
}
