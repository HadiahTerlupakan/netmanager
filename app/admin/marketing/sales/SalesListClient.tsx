'use client'

import React, { useState, useEffect } from 'react'
import {
    HiMagnifyingGlass,
    HiOutlineUsers,
    HiOutlineBuildingOffice,
    HiOutlineIdentification,
    HiOutlinePhone,
    HiOutlinePencilSquare,
    HiOutlineChartBar,
    HiOutlineTrophy,
    HiOutlineClipboardDocumentCheck,
    HiOutlineClock
} from 'react-icons/hi2'
import { ResponsiveTable, type Column } from '@/components/ui/ResponsiveTable'
import { toast } from 'react-hot-toast'
import { useRouter } from 'next/navigation'
import { usePermission } from '@/hooks/use-permission'

interface SalesUser {
    id: string
    name: string | null
    email: string
    phone: string | null
    canvasingTarget: number
    departments: { name: string } | null
    sites: {
        code: string
        name: string
    } | null
    stats?: {
        achieved: number
        pending: number
    }
}

interface SalesStats {
    totalSales: number
    totalTarget: number
    totalAchieved: number
    totalPending: number
}

export default function SalesListClient() {
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [users, setUsers] = useState<SalesUser[]>([])
    const [stats, setStats] = useState<SalesStats>({
        totalSales: 0,
        totalTarget: 0,
        totalAchieved: 0,
        totalPending: 0
    })
    const [searchTerm, setSearchTerm] = useState('')
    
    // Permission checks
    const { hasPermission } = usePermission()
    const canUpdate = hasPermission('sales:update')

    // Edit Target Modal
    const [editingUser, setEditingUser] = useState<SalesUser | null>(null)
    const [newTarget, setNewTarget] = useState<number>(0)
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        fetchSalesUsers()
    }, [])

    const fetchSalesUsers = async () => {
        try {
            setLoading(true)
            const res = await fetch('/api/admin/marketing/sales')
            if (res.ok) {
                const json = await res.json()
                // Handle new response structure
                if (json.data && json.data.users) {
                    setUsers(json.data.users)
                    setStats(json.data.stats)
                } else {
                    // Fallback for safety
                    setUsers(json.data || [])
                }
            } else {
                toast.error('Gagal memuat data sales')
            }
        } catch (error) {
            console.error('Error:', error)
            toast.error('Terjadi kesalahan')
        } finally {
            setLoading(false)
        }
    }

    const handleEditClick = (user: SalesUser) => {
        setEditingUser(user)
        setNewTarget(user.canvasingTarget || 50)
    }

    const handleSaveTarget = async () => {
        if (!editingUser) return

        try {
            setSaving(true)
            const res = await fetch(`/api/admin/users/${editingUser.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ canvasingTarget: newTarget })
            })

            if (res.ok) {
                toast.success('Target berhasil diperbarui')
                setUsers(prev => prev.map(u => 
                    u.id === editingUser.id ? { ...u, canvasingTarget: newTarget } : u
                ))
                // Optimistically update total target (simplified logic)
                setStats(prev => ({
                    ...prev,
                    totalTarget: prev.totalTarget - (editingUser.canvasingTarget || 0) + newTarget
                }))
                setEditingUser(null)
            } else {
                toast.error('Gagal menyimpan target')
            }
        } catch (error) {
            console.error('Error saving target:', error)
            toast.error('Gagal menghubungi server')
        } finally {
            setSaving(false)
        }
    }

    const filteredUsers = users.filter(user => 
        user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.departments?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.sites?.name.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const columns: Column<SalesUser>[] = [
        {
            key: 'name',
            header: 'Sales',
            priority: 'primary',
            render: (user) => (
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                        <HiOutlineIdentification className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div>
                        <div className="font-medium text-gray-900 dark:text-white">{user.name || '-'}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{user.email}</div>
                    </div>
                </div>
            )
        },
        {
            key: 'departments',
            header: 'Departemen & Site',
            priority: 'secondary',
            render: (user) => (
                <div className="flex flex-col gap-1">
                    <span className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400">
                        <HiOutlineBuildingOffice className="w-3.5 h-3.5" />
                        {user.departments?.name || '-'}
                    </span>
                    <span className="text-xs text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full w-fit">
                        {user.sites ? `${user.sites.code} - ${user.sites.name}` : '-'}
                    </span>
                </div>
            )
        },
        {
            key: 'phone',
            header: 'Kontak',
            priority: 'secondary',
            render: (user) => (
                <div className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400">
                    <HiOutlinePhone className="w-3.5 h-3.5" />
                    {user.phone || '-'}
                </div>
            )
        },
        {
            key: 'canvasingTarget',
            header: 'Target Bulanan',
            priority: 'primary',
            render: (user) => {
                const target = user.canvasingTarget || 1
                const achieved = user.stats?.achieved || 0
                const progress = Math.min((achieved / target) * 100, 100)

                return (
                    <div className="flex-1">
                        <div className="mb-1 flex justify-between items-end">
                            <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                                {achieved} <span className="text-gray-400 text-xs font-normal">/ {target}</span>
                            </span>
                            <span className="text-xs text-gray-500">{Math.round(progress)}%</span>
                        </div>
                        <div className="w-32 h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    </div>
                )
            }
        }
    ]

    const renderActions = (user: SalesUser) => (
        <div className="flex items-center justify-end gap-1">
            <button
                onClick={(e) => {
                    e.stopPropagation()
                    router.push(`/admin/marketing/sales/${user.id}`)
                }}
                className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
                title="Lihat Performa"
            >
                <HiOutlineChartBar className="w-5 h-5" />
            </button>
            {canUpdate && (
                <button
                    onClick={(e) => {
                        e.stopPropagation()
                        handleEditClick(user)
                    }}
                    className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
                    title="Ubah Target"
                >
                    <HiOutlinePencilSquare className="w-5 h-5" />
                </button>
            )}
        </div>
    )

    const emptyState = (
        <div className="flex flex-col items-center py-2">
            <HiOutlineUsers className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
            <p className="text-gray-500 dark:text-gray-400">Belum ada user yang ditandai sebagai Sales.</p>
            <p className="text-sm text-gray-400 mt-1">Buka menu <b>Users</b>, edit user, dan aktifkan &quot;Fitur Sales&quot;.</p>
        </div>
    )

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-2">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Manajemen Sales</h1>
                <p className="text-gray-600 dark:text-gray-400">
                    Kelola tim sales dan monitoring pencapaian target bulan ini
                </p>
            </div>

            {/* Performance Cards - Mobile Responsive Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col gap-2">
                    <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg w-fit">
                        <HiOutlineUsers className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide">Total Sales</p>
                        <p className="text-xl font-bold text-gray-900 dark:text-white">{stats.totalSales}</p>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col gap-2">
                    <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg w-fit">
                        <HiOutlineTrophy className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide">Total Target</p>
                        <p className="text-xl font-bold text-gray-900 dark:text-white">{stats.totalTarget}</p>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col gap-2">
                    <div className="p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg w-fit">
                        <HiOutlineClipboardDocumentCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide">Tercapai</p>
                        <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{stats.totalAchieved}</p>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col gap-2">
                    <div className="p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg w-fit">
                        <HiOutlineClock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide">Menunggu</p>
                        <p className="text-xl font-bold text-amber-600 dark:text-amber-400">{stats.totalPending}</p>
                    </div>
                </div>
            </div>

            {/* Filter */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
                <div className="relative">
                    <HiMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Cari sales berdasarkan nama, email, atau area..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                    />
                </div>
            </div>

            {/* List */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                <ResponsiveTable
                    data={filteredUsers}
                    columns={columns}
                    keyField="id"
                    loading={loading}
                    loadingMessage="Memuat data sales..."
                    emptyMessage={emptyState}
                    renderActions={renderActions}
                    onRowClick={(user) => router.push(`/admin/marketing/sales/${user.id}`)}
                />
            </div>

            {/* Edit Modal */}
            {editingUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-sm w-full overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
                            <h3 className="font-semibold text-gray-900 dark:text-white">Ubah Target Canvasing</h3>
                            <button 
                                onClick={() => setEditingUser(null)}
                                className="text-gray-400 hover:text-gray-600 transition-colors"
                            >
                                &times;
                            </button>
                        </div>
                        
                        <div className="p-6">
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Target Bulanan ({editingUser.name})
                                </label>
                                <div className="flex items-center gap-3">
                                    <input
                                        type="number"
                                        min="0"
                                        value={newTarget}
                                        onChange={(e) => setNewTarget(parseInt(e.target.value) || 0)}
                                        className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 font-mono text-lg"
                                    />
                                    <span className="text-gray-500 font-medium">Data</span>
                                </div>
                                <p className="text-xs text-gray-500 mt-2">
                                    Target ini akan muncul di dashboard aplikasi mobile user.
                                </p>
                            </div>

                            <div className="flex gap-3 mt-6">
                                <button
                                    onClick={() => setEditingUser(null)}
                                    disabled={saving}
                                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 font-medium transition-colors"
                                >
                                    Batal
                                </button>
                                <button
                                    onClick={handleSaveTarget}
                                    disabled={saving}
                                    className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-colors shadow-sm shadow-indigo-200 dark:shadow-none flex justify-center items-center"
                                >
                                    {saving ? (
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        'Simpan'
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
