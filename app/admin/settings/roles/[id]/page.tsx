'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { usePermission } from '@/hooks/use-permission'
import { toast } from 'react-hot-toast'
import { FiArrowLeft, FiSave } from 'react-icons/fi'
import { PERMISSION_GROUPS, PERMISSION_GROUPS_KARYAWAN, ACTIONS } from '@/lib/permission-config'

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
        isRestricted: false,
        permissions: [] as string[] // Store permission IDs (resource:action)
    })
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [activeTab, setActiveTab] = useState<'admin' | 'employee'>('admin')

    useEffect(() => {
        const fetchData = async () => {
            try {
                // If editing, fetch role data
                if (!isNew) {
                    const roleRes = await fetch(`/api/roles/${roleId}`)
                    const roleData = await roleRes.json()

                    if (roleRes.ok) {
                        setFormData({
                            name: roleData.name,
                            description: roleData.description || '',
                            accessAdminPanel: roleData.accessAdminPanel || false,
                            accessEmployeePanel: roleData.accessEmployeePanel || false,
                            isRestricted: roleData.isRestricted || false,
                            // Convert backend permissions (objects) to string format resource:action
                            permissions: roleData.permissions.map((p: any) => `${p.resource}:${p.action}`)
                        })
                    } else {
                        toast.error(roleData.error || 'Failed to fetch role')
                        router.push('/admin/settings/roles')
                    }
                }
            } catch (error) {
                console.error('Error fetching data:', error)
                toast.error('Gagal memuat data')
            } finally {
                setLoading(false)
            }
        }

        fetchData()
    }, [isNew, roleId, router])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setSaving(true)

        try {
            const url = isNew ? '/api/roles' : `/api/roles/${roleId}`
            const method = isNew ? 'POST' : 'PUT'

            if (isNew && formData.name.toLowerCase() === 'new') {
                toast.error('Nama role tidak boleh "new"')
                setSaving(false)
                return
            }

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
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

    if (authLoading || loading) return <div className="p-8 text-center">Loading...</div>

    const requiredPerm = isNew ? 'roles:create' : 'roles:update'
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

                {/* Role Type */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h2 className="text-lg font-semibold mb-4 text-gray-700">Tipe Role</h2>
                    <label className="flex items-start gap-3 p-4 border border-gray-200 rounded-xl hover:bg-gray-50 cursor-pointer transition-colors">
                        <input
                            type="checkbox"
                            checked={formData.isRestricted}
                            onChange={e => setFormData({ ...formData, isRestricted: e.target.checked })}
                            className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 border-gray-300 mt-0.5"
                        />
                        <div>
                            <span className="block font-medium text-gray-800">Role Terbatas (Restricted)</span>
                            <span className="text-sm text-gray-500">
                                Jika aktif, role ini <strong>tidak akan muncul</strong> pada dropdown "Peran Pengguna" di menu Tambah/Edit Pengguna,
                                KECUALI user yang sedang login juga memiliki role ini.
                            </span>
                        </div>
                    </label>
                </div>

                {/* Permission Matrix */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-lg font-semibold text-gray-700">Matrix Hak Akses</h2>
                        <div className="flex bg-gray-100 p-1 rounded-lg">
                            <button
                                type="button"
                                onClick={() => setActiveTab('admin')}
                                className={`flex-1 py-1.5 px-3 text-sm font-medium rounded-md transition-all ${activeTab === 'admin'
                                    ? 'bg-white text-gray-800 shadow-sm'
                                    : 'text-gray-500 hover:text-gray-700'
                                    }`}
                            >
                                Portal Admin
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab('employee')}
                                className={`flex-1 py-1.5 px-3 text-sm font-medium rounded-md transition-all ${activeTab === 'employee'
                                    ? 'bg-white text-gray-800 shadow-sm'
                                    : 'text-gray-500 hover:text-gray-700'
                                    }`}
                            >
                                Portal Karyawan
                            </button>
                        </div>
                    </div>

                    <div className="space-y-8">
                        {(Object.entries(activeTab === 'admin' ? PERMISSION_GROUPS : PERMISSION_GROUPS_KARYAWAN) as unknown as [string, string[]][]).map(([groupName, resources]) => {
                            const groupActions = resources.flatMap(resource =>
                                ACTIONS.map(action => `${resource}:${action}`)
                            )
                            const selectedGroupActions = groupActions.filter(p => formData.permissions.includes(p))
                            const isGroupChecked = groupActions.every(p => formData.permissions.includes(p))
                            const isGroupIndeterminate = selectedGroupActions.length > 0 && !isGroupChecked

                            const handleGroupToggle = (checked: boolean) => {
                                let newPermissions = [...formData.permissions]
                                if (checked) {
                                    groupActions.forEach(p => {
                                        if (!newPermissions.includes(p)) newPermissions.push(p)
                                    })
                                } else {
                                    newPermissions = newPermissions.filter(p => !groupActions.includes(p))
                                }
                                setFormData({ ...formData, permissions: newPermissions })
                            }

                            return (
                                <div key={groupName} className="border border-gray-200 rounded-xl overflow-hidden">
                                    <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="checkbox"
                                                checked={isGroupChecked}
                                                ref={input => {
                                                    if (input) input.indeterminate = isGroupIndeterminate
                                                }}
                                                onChange={(e) => handleGroupToggle(e.target.checked)}
                                                className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500 border-gray-300 cursor-pointer"
                                            />
                                            <h3 className="font-semibold text-gray-800 capitalize">{groupName.toLowerCase().replace(/_/g, ' ')}</h3>
                                        </div>
                                    </div>

                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm text-left">
                                            <thead className="text-xs text-gray-700 uppercase bg-gray-50/50 border-b border-gray-100">
                                                <tr>
                                                    <th className="px-6 py-3 font-medium text-gray-500">Resource</th>
                                                    {ACTIONS.map(action => (
                                                        <th key={action} className="px-6 py-3 font-medium text-gray-500 text-center w-24">
                                                            {action}
                                                        </th>
                                                    ))}
                                                    <th className="px-6 py-3 font-medium text-gray-500 text-center w-24">All</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {resources.map(resource => {
                                                    const resourceActions = ACTIONS.map(action => `${resource}:${action}`)
                                                    const isAllResourceChecked = resourceActions.every(p => formData.permissions.includes(p))

                                                    const handleResourceAllToggle = (checked: boolean) => {
                                                        let newPermissions = [...formData.permissions]
                                                        if (checked) {
                                                            resourceActions.forEach(p => {
                                                                if (!newPermissions.includes(p)) newPermissions.push(p)
                                                            })
                                                        } else {
                                                            newPermissions = newPermissions.filter(p => !resourceActions.includes(p))
                                                        }
                                                        setFormData({ ...formData, permissions: newPermissions })
                                                    }

                                                    return (
                                                        <tr key={resource} className="hover:bg-gray-50/50 transition-colors">
                                                            <td className="px-6 py-3 font-medium text-gray-700 capitalize">
                                                                {resource.replace(/^k_/, '').replace(/_/g, ' ')}
                                                            </td>
                                                            {ACTIONS.map(action => {
                                                                const permissionId = `${resource}:${action}`
                                                                const isChecked = formData.permissions.includes(permissionId)

                                                                const togglePermission = () => {
                                                                    let newPermissions = [...formData.permissions]
                                                                    if (isChecked) {
                                                                        newPermissions = newPermissions.filter(p => p !== permissionId)
                                                                    } else {
                                                                        newPermissions.push(permissionId)
                                                                    }
                                                                    setFormData({ ...formData, permissions: newPermissions })
                                                                }

                                                                return (
                                                                    <td key={action} className="px-6 py-3 text-center">
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={isChecked}
                                                                            onChange={togglePermission}
                                                                            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300 cursor-pointer"
                                                                        />
                                                                    </td>
                                                                )
                                                            })}
                                                            <td className="px-6 py-3 text-center border-l border-gray-100">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={isAllResourceChecked}
                                                                    onChange={(e) => handleResourceAllToggle(e.target.checked)}
                                                                    className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 border-gray-300 cursor-pointer"
                                                                />
                                                            </td>
                                                        </tr>
                                                    )
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>

                <div className="flex justify-end gap-3 pt-6 border-t border-gray-100">
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
