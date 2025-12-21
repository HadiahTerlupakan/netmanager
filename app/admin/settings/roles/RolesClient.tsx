'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { usePermission } from '@/hooks/use-permission'
import { toast } from 'react-hot-toast'
import { FiPlus, FiEdit2, FiTrash2 } from 'react-icons/fi'

interface Role {
    id: string
    name: string
    description: string
    _count?: {
        users: number
    }
}

export function ClientComponent() {
    const [roles, setRoles] = useState<Role[]>([])
    const [loading, setLoading] = useState(true)
    const router = useRouter()
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
        } catch (error: any) {
            toast.error(error.message)
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
                    <h1 className="text-2xl font-bold text-gray-800">Manajemen Role</h1>
                    <p className="text-gray-600">Atur hak akses pengguna aplikasi</p>
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

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-gray-50 border-b border-gray-100">
                        <tr>
                            <th className="px-6 py-4 font-semibold text-gray-700">Nama Role</th>
                            <th className="px-6 py-4 font-semibold text-gray-700">Deskripsi</th>
                            <th className="px-6 py-4 font-semibold text-gray-700 text-center">Users</th>
                            <th className="px-6 py-4 font-semibold text-gray-700 text-right">Aksi</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {roles.map((role) => (
                            <tr key={role.id} className="hover:bg-gray-50 transition-colors">
                                <td className="px-6 py-4 font-medium text-gray-900">{role.name}</td>
                                <td className="px-6 py-4 text-gray-500">{role.description || '-'}</td>
                                <td className="px-6 py-4 text-center">
                                    <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                                        {role._count?.users || 0} User
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex justify-end gap-2">
                                        {hasPermission('roles:update') && (
                                            <Link
                                                href={`/admin/settings/roles/${role.id}`}
                                                className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                title="Edit Role"
                                            >
                                                <FiEdit2 />
                                            </Link>
                                        )}
                                        {hasPermission('roles:delete') && role.name !== 'SUPER_ADMIN' && (
                                            <button
                                                onClick={() => handleDelete(role.id, role.name)}
                                                disabled={(role._count?.users || 0) > 0}
                                                className={`p-2 rounded-lg transition-colors ${(role._count?.users || 0) > 0
                                                        ? 'text-gray-300 cursor-not-allowed'
                                                        : 'text-gray-600 hover:text-red-600 hover:bg-red-50'
                                                    }`}
                                                title={(role._count?.users || 0) > 0 ? 'Tidak dapat menghapus role yang memiliki user aktif' : 'Hapus Role'}
                                            >
                                                <FiTrash2 />
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {roles.length === 0 && (
                            <tr>
                                <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                                    Belum ada data role.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
