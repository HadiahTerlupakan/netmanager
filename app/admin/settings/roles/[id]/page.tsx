'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { usePermission } from '@/hooks/use-permission'
import { toast } from 'react-hot-toast'
import { FiArrowLeft, FiSave } from 'react-icons/fi'

interface Permission {
    id: string
    name: string
    action: string
    resource: string
    description?: string
}

export default function RoleFormPage() {
    const router = useRouter()
    const params = useParams()
    const { hasPermission, isLoading: authLoading } = usePermission()

    const isNew = params?.id === 'new'
    const roleId = params?.id as string

    const [formData, setFormData] = useState({
        name: '',
        description: '',
        accessAdminPanel: false,
        accessEmployeePanel: false,
    })
    const [selectedPermissions, setSelectedPermissions] = useState<string[]>([])
    const [availablePermissions, setAvailablePermissions] = useState<Permission[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)

    // Group permissions by resource for the matrix
    const permissionsByResource = availablePermissions.reduce((acc, perm) => {
        if (!acc[perm.resource]) {
            acc[perm.resource] = []
        }
        acc[perm.resource].push(perm)
        return acc
    }, {} as Record<string, Permission[]>)

    const uniqueActions = Array.from(new Set(availablePermissions.map(p => p.action))).sort()

    useEffect(() => {
        Promise.all([
            fetchPermissions(),
            !isNew && roleId ? fetchRole(roleId) : Promise.resolve()
        ]).finally(() => setLoading(false))
    }, [roleId, isNew])

    const fetchPermissions = async () => {
        try {
            const res = await fetch('/api/permissions')
            if (res.ok) {
                setAvailablePermissions(await res.json())
            }
        } catch (e) {
            console.error(e)
        }
    }

    const fetchRole = async (id: string) => {
        try {
            const res = await fetch(`/api/roles/${id}`)
            if (res.ok) {
                const data = await res.json()
                setFormData({
                    name: data.name,
                    description: data.description || '',
                    accessAdminPanel: data.accessAdminPanel || false,
                    accessEmployeePanel: data.accessEmployeePanel || false,
                })
                setSelectedPermissions(data.permissions.map((p: any) => p.id))
            } else {
                toast.error('Gagal memuat data role')
                router.push('/admin/settings/roles')
            }
        } catch (e) {
            console.error(e)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setSaving(true)

        try {
            const url = isNew ? '/api/roles' : `/api/roles/${roleId}`
            const method = isNew ? 'POST' : 'PUT'

            // Clean default values like "new"
            if (isNew && formData.name.toLowerCase() === 'new') {
                toast.error('Nama role tidak boleh "new"')
                setSaving(false)
                return
            }

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...formData,
                    permissions: selectedPermissions
                })
            })

            const data = await res.json()

            if (!res.ok) {
                throw new Error(data.error || 'Gagal menyimpan role')
            }

            toast.success(isNew ? 'Role berhasil dibuat' : 'Role berhasil diperbarui')
            router.push('/admin/settings/roles')
        } catch (error: any) {
            toast.error(error.message)
        } finally {
            setSaving(false)
        }
    }

    const togglePermission = (id: string) => {
        setSelectedPermissions(prev =>
            prev.includes(id)
                ? prev.filter(p => p !== id)
                : [...prev, id]
        )
    }

    const toggleRow = (resource: string, checked: boolean) => {
        const resourcePerms = permissionsByResource[resource].map(p => p.id)
        if (checked) {
            // Add all not already selected
            const toAdd = resourcePerms.filter(id => !selectedPermissions.includes(id))
            setSelectedPermissions(prev => [...prev, ...toAdd])
        } else {
            // Remove all
            setSelectedPermissions(prev => prev.filter(id => !resourcePerms.includes(id)))
        }
    }

    if (authLoading || loading) return <div className="p-8 text-center">Loading...</div>

    // Permission check
    const requiredPerm = isNew ? 'role:create' : 'role:update'
    if (!hasPermission(requiredPerm)) {
        return <div className="p-8 text-center text-red-500">Anda tidak memiliki akses untuk {isNew ? 'membuat' : 'mengedit'} role.</div>
    }

    return (
        <div className="p-6 max-w-5xl mx-auto">
            <div className="flex items-center gap-4 mb-6">
                <Link
                    href="/admin/settings/roles"
                    className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                    <FiArrowLeft className="text-xl" />
                </Link>
                <h1 className="text-2xl font-bold text-gray-800">
                    {isNew ? 'Tambah Role Baru' : `Edit Role: ${formData.name}`}
                </h1>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Basic Info */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h2 className="text-lg font-semibold mb-4 text-gray-700">Informasi Dasar</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Nama Role</label>
                            <input
                                type="text"
                                required
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                                placeholder="Contoh: Staff Keuangan"
                                disabled={formData.name === 'SUPER_ADMIN'}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Deskripsi</label>
                            <input
                                type="text"
                                value={formData.description}
                                onChange={e => setFormData({ ...formData, description: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                                placeholder="Deskripsi singkat role ini"
                            />
                        </div>
                    </div>
                </div>

                {/* Portal Access */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h2 className="text-lg font-semibold mb-4 text-gray-700">Akses Portal</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <label className="flex items-start gap-3 p-4 border border-gray-200 rounded-xl hover:bg-gray-50 cursor-pointer transition-colors">
                            <input
                                type="checkbox"
                                checked={formData.accessAdminPanel}
                                onChange={e => setFormData({ ...formData, accessAdminPanel: e.target.checked })}
                                className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 border-gray-300 mt-0.5"
                            />
                            <div>
                                <span className="block font-medium text-gray-800">Portal Admin</span>
                                <span className="text-sm text-gray-500">Izinkan akses ke dashboard admin dan manajemen sistem ({`/admin`}).</span>
                            </div>
                        </label>
                        <label className="flex items-start gap-3 p-4 border border-gray-200 rounded-xl hover:bg-gray-50 cursor-pointer transition-colors">
                            <input
                                type="checkbox"
                                checked={formData.accessEmployeePanel}
                                onChange={e => setFormData({ ...formData, accessEmployeePanel: e.target.checked })}
                                className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 border-gray-300 mt-0.5"
                            />
                            <div>
                                <span className="block font-medium text-gray-800">Portal Karyawan</span>
                                <span className="text-sm text-gray-500">Izinkan akses ke area kerja karyawan ({`/karyawan`}).</span>
                            </div>
                        </label>
                    </div>
                </div>

                {/* Permission Matrix */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-lg font-semibold text-gray-700">Hak Akses (Permissions)</h2>
                        <div className="text-sm text-gray-500">
                            Pilih hak akses yang diizinkan untuk role ini.
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th className="px-4 py-3 text-left font-medium text-gray-600">Menu / Resource</th>
                                    {uniqueActions.map(action => (
                                        <th key={action} className="px-4 py-3 text-center font-medium text-gray-600 capitalize">
                                            {action}
                                        </th>
                                    ))}
                                    <th className="px-4 py-3 text-center font-medium text-gray-600">All</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {Object.entries(permissionsByResource).map(([resource, perms]) => {
                                    const allSelected = perms.every(p => selectedPermissions.includes(p.id))
                                    return (
                                        <tr key={resource} className="hover:bg-gray-50">
                                            <td className="px-4 py-3 font-medium text-gray-800 capitalize">
                                                {resource}
                                            </td>
                                            {uniqueActions.map(action => {
                                                const perm = perms.find(p => p.action === action)
                                                return (
                                                    <td key={action} className="px-4 py-3 text-center">
                                                        {perm ? (
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedPermissions.includes(perm.id)}
                                                                onChange={() => togglePermission(perm.id)}
                                                                className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 border-gray-300 cursor-pointer"
                                                            />
                                                        ) : (
                                                            <span className="text-gray-300">-</span>
                                                        )}
                                                    </td>
                                                )
                                            })}
                                            <td className="px-4 py-3 text-center border-l border-gray-100">
                                                <input
                                                    type="checkbox"
                                                    checked={allSelected}
                                                    onChange={(e) => toggleRow(resource, e.target.checked)}
                                                    className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 border-gray-300 cursor-pointer"
                                                />
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="flex justify-end gap-3">
                    <Link
                        href="/admin/settings/roles"
                        className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium"
                    >
                        Batal
                    </Link>
                    <button
                        type="submit"
                        disabled={saving}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        <FiSave />
                        {saving ? 'Menyimpan...' : 'Simpan Role'}
                    </button>
                </div>
            </form>
        </div>
    )
}
