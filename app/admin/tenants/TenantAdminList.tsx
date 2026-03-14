'use client'

import { useState, useEffect, useCallback } from 'react'
import { HiOutlineUserCircle, HiOutlinePlus, HiOutlineBuildingOffice, HiOutlineEnvelope, HiOutlinePhone } from 'react-icons/hi2'
import PageLoader from '@/components/ui/PageLoader'
import { toast } from 'react-hot-toast'
import { ResponsiveTable, type Column } from '@/components/ui/ResponsiveTable'
import { Modal, ModalFooter } from '@/components/ui/Modal'

interface User {
    id: string
    email: string
    name: string | null
    phone: string | null
    isActive: boolean
    role?: {
        name: string
    }
}

interface Tenant {
    id: string
    name: string
}

interface Role {
    id: string
    name: string
}

export default function TenantAdminList({ initialTenantId }: { initialTenantId: string | null }) {
    const [tenants, setTenants] = useState<Tenant[]>([])
    const [selectedTenantId, setSelectedTenantId] = useState<string>(initialTenantId || '')
    const [users, setUsers] = useState<User[]>([])
    const [loading, setLoading] = useState(false)
    const [isFormOpen, setIsFormOpen] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [formData, setFormData] = useState({
        id: '', // For editing
        email: '',
        name: '',
        password: '',
        phone: '',
    })
    const [isDeleting, setIsDeleting] = useState(false)
    const [userToDelete, setUserToDelete] = useState<User | null>(null)
    const [isEditMode, setIsEditMode] = useState(false)

    const fetchTenants = useCallback(async () => {
        try {
            const res = await fetch('/api/admin/tenants?isActive=true')
            const data = await res.json()
            if (res.ok) {
                const list = data.data || []
                setTenants(list)
                if (!selectedTenantId && list.length > 0) {
                    setSelectedTenantId(list[0].id)
                }
            }
        } catch (error) {
            console.error(error)
        }
    }, [selectedTenantId])

    const fetchAdmins = useCallback(async () => {
        try {
            setLoading(true)
            const res = await fetch(`/api/admin/users?tenantId=${selectedTenantId}`)
            const data = await res.json()
            if (res.ok) {
                setUsers(data.data?.users || data.users || [])
            } else {
                toast.error(data.error || 'Gagal memuat admin')
            }
        } catch (error) {
            console.error(error)
            toast.error('Gagal memuat data admin')
        } finally {
            setLoading(false)
        }
    }, [selectedTenantId])

    useEffect(() => {
        fetchTenants()
    }, [fetchTenants])

    useEffect(() => {
        if (selectedTenantId) {
            fetchAdmins()
        } else {
            setUsers([])
        }
    }, [selectedTenantId, fetchAdmins])

    const handleOpenCreate = () => {
        setIsEditMode(false)
        setFormData({ id: '', email: '', name: '', password: '', phone: '' })
        setIsFormOpen(true)
    }

    const handleOpenEdit = (user: User) => {
        setIsEditMode(true)
        setFormData({
            id: user.id,
            email: user.email,
            name: user.name || '',
            password: '', // Password empty when editing
            phone: user.phone || '',
        })
        setIsFormOpen(true)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!selectedTenantId) return
        
        setIsSaving(true)
        try {
            const roleRes = await fetch('/api/roles')
            const roles = await roleRes.json()
            const adminRole = Array.isArray(roles) 
                ? roles.find((r: Role) => r.name.toUpperCase() === 'ADMIN') 
                : null
            
            if (!adminRole) {
                toast.error('Peran Administrator tidak ditemukan di sistem')
                setIsSaving(false)
                return
            }

            const url = isEditMode ? `/api/admin/users/${formData.id}` : '/api/admin/users'
            const method = isEditMode ? 'PATCH' : 'POST'

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: formData.email,
                    name: formData.name,
                    ...(formData.password && { password: formData.password }),
                    phone: formData.phone || undefined,
                    tenantId: selectedTenantId,
                    roleId: adminRole.id,
                    isActive: true,
                    // Default fields required by createUserSchema (only for POST)
                    ...(!isEditMode && {
                        isSales: false,
                        workingHourMode: 'FIXED',
                        attendanceGeofencePolicy: 'WARN',
                        startWorkTime: '09:00',
                        endWorkTime: '17:00',
                        workDays: 'Mon,Tue,Wed,Thu,Fri',
                        flexibleTargetHour: 8,
                    })
                })
            })

            const data = await res.json()
            if (res.ok) {
                toast.success(isEditMode ? 'Administrator berhasil diperbarui' : 'Administrator berhasil ditambahkan')
                setIsFormOpen(false)
                setFormData({ id: '', email: '', name: '', password: '', phone: '' })
                fetchAdmins()
            } else {
                const errorMsg = data.details 
                    ? Object.values(data.details).join(', ') 
                    : (data.error || 'Gagal menyimpan admin')
                toast.error(errorMsg)
            }
        } catch (_error) {
            toast.error('Terjadi kesalahan sistem')
        } finally {
            setIsSaving(false)
        }
    }

    const handleDeleteUser = async () => {
        if (!userToDelete) return
        setIsDeleting(true)
        try {
            const res = await fetch(`/api/admin/users/${userToDelete.id}`, {
                method: 'DELETE'
            })
            if (res.ok) {
                toast.success('Admin berhasil dihapus')
                setUserToDelete(null)
                fetchAdmins()
            } else {
                const data = await res.json()
                toast.error(data.error || 'Gagal menghapus admin')
            }
        } catch (_error) {
            toast.error('Kesalahan sistem saat menghapus')
        } finally {
            setIsDeleting(false)
        }
    }

    const columns: Column<User>[] = [
        {
            key: 'name',
            header: 'Administrator',
            priority: 'primary',
            render: (user) => (
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold">
                        {user.name ? user.name.charAt(0).toUpperCase() : <HiOutlineUserCircle className="w-6 h-6" />}
                    </div>
                    <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{user.name || 'No Name'}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{user.email}</p>
                    </div>
                </div>
            )
        },
        {
            key: 'phone',
            header: 'Telepon',
            priority: 'secondary',
            render: (user) => (
                <div className="text-sm text-gray-600 dark:text-gray-400">
                    {user.phone || '-'}
                </div>
            )
        },
        {
            key: 'isActive',
            header: 'Status',
            priority: 'primary',
            render: (user) => (
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${user.isActive
                    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                    }`}>
                    {user.isActive ? 'Active' : 'Inactive'}
                </span>
            )
        }
    ]

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-3 flex-1">
                    <HiOutlineBuildingOffice className="w-5 h-5 text-gray-400" />
                    <select
                        value={selectedTenantId}
                        onChange={(e) => setSelectedTenantId(e.target.value)}
                        className="flex-1 max-w-xs px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                    >
                        <option value="">Pilih Tenant...</option>
                        {tenants.map(t => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                    </select>
                </div>
                <button
                    onClick={handleOpenCreate}
                    disabled={!selectedTenantId}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <HiOutlinePlus className="w-5 h-5" />
                    Tambah Admin
                </button>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden min-h-[300px]">
                {loading ? (
                    <PageLoader variant="section" message="Memuat administrator..." />
                ) : !selectedTenantId ? (
                    <div className="py-20 text-center">
                        <HiOutlineBuildingOffice className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">Pilih Tenant</h3>
                        <p className="text-gray-500">Silakan pilih tenant untuk mengelola administrator secara spesifik.</p>
                    </div>
                ) : users.length === 0 ? (
                    <div className="py-20 text-center">
                        <HiOutlineUserCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">Belum Ada Admin</h3>
                        <p className="text-gray-500 mb-6">Tenant ini belum memiliki administrator akun sistem.</p>
                        <button
                            onClick={handleOpenCreate}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
                        >
                            <HiOutlinePlus className="w-5 h-5" />
                            Tambah Admin Pertama
                        </button>
                    </div>
                ) : (
                    <ResponsiveTable
                        data={users}
                        columns={columns}
                        keyField="id"
                        renderActions={(user) => (
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => handleOpenEdit(user)}
                                    className="p-1.5 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-md transition-colors"
                                    title="Edit"
                                >
                                    Edit
                                </button>
                                <button
                                    onClick={() => setUserToDelete(user)}
                                    className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-md transition-colors"
                                    title="Hapus"
                                >
                                    Hapus
                                </button>
                            </div>
                        )}
                    />
                )}
            </div>

            <Modal
                isOpen={isFormOpen}
                onClose={() => setIsFormOpen(false)}
                title={`${isEditMode ? 'Edit' : 'Tambah'} Administrator Tenant`}
                size="md"
            >
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg mb-2">
                        <p className="text-xs text-indigo-700 dark:text-indigo-300 flex items-center gap-2">
                            <HiOutlineBuildingOffice className="w-4 h-4" />
                            Target Tenant: <span className="font-bold">{tenants.find(t => t.id === selectedTenantId)?.name}</span>
                        </p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email <span className="text-red-500">*</span></label>
                        <div className="relative">
                            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <HiOutlineEnvelope className="h-4 w-4 text-gray-400" />
                            </span>
                            <input
                                type="email"
                                required
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                                placeholder="email@tenant.com"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nama Lengkap <span className="text-red-500">*</span></label>
                        <div className="relative">
                            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <HiOutlineUserCircle className="h-4 w-4 text-gray-400" />
                            </span>
                            <input
                                type="text"
                                required
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                                placeholder="Nama Administrator"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Password {isEditMode && <span className="text-xs text-gray-500">(Kosongkan jika tidak ingin diubah)</span>} {!isEditMode && <span className="text-red-500">*</span>}
                        </label>
                        <input
                            type="password"
                            required={!isEditMode}
                            value={formData.password}
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                            placeholder={isEditMode ? "********" : "Minimal 8 karakter"}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Telepon (Opsional)</label>
                        <div className="relative">
                            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <HiOutlinePhone className="h-4 w-4 text-gray-400" />
                            </span>
                            <input
                                type="tel"
                                value={formData.phone}
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                                placeholder="08xxxxxx"
                            />
                        </div>
                    </div>

                    <ModalFooter className="pt-4 mt-6">
                        <button
                            type="button"
                            onClick={() => setIsFormOpen(false)}
                            disabled={isSaving}
                            className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        >
                            Batal
                        </button>
                        <button
                            type="submit"
                            disabled={isSaving}
                            className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-50"
                        >
                            {isSaving ? 'Menyimpan...' : isEditMode ? 'Perbarui Admin' : 'Simpan Admin'}
                        </button>
                    </ModalFooter>
                </form>
            </Modal>

            {/* Modal Konfirmasi Hapus */}
            <Modal
                isOpen={!!userToDelete}
                onClose={() => setUserToDelete(null)}
                title="Konfirmasi Hapus"
                size="sm"
            >
                <div className="p-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        Apakah Anda yakin ingin menghapus administrator <span className="font-bold text-gray-900 dark:text-white">{userToDelete?.name}</span>?
                        Tindakan ini tidak dapat dibatalkan.
                    </p>
                    <ModalFooter className="mt-6">
                        <button
                            type="button"
                            onClick={() => setUserToDelete(null)}
                            className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                            Batal
                        </button>
                        <button
                            type="button"
                            onClick={handleDeleteUser}
                            disabled={isDeleting}
                            className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                        >
                            {isDeleting ? 'Menghapus...' : 'Ya, Hapus'}
                        </button>
                    </ModalFooter>
                </div>
            </Modal>
        </div>
    )
}
