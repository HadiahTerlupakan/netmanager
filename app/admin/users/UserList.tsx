'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { HiOutlinePlus, HiOutlineUserCircle, HiMagnifyingGlass, HiOutlineUsers, HiOutlineBuildingOffice, HiOutlineEye, HiOutlineTrash, HiOutlineCheckCircle, HiOutlineXCircle, HiOutlineFunnel, HiOutlineArrowRightOnRectangle, HiOutlineDevicePhoneMobile } from 'react-icons/hi2'
import PageLoader from '@/components/ui/PageLoader'
import { toast } from 'react-hot-toast'
import { ResponsiveTable, type Column } from '@/components/ui/ResponsiveTable'
import { useSocket } from '@/hooks/useSocket'
import { SOCKET_EVENTS } from '@/lib/websocket/types'

interface User {
    id: string
    email: string
    name: string | null
    phone: string | null
    departmentId: string | null
    siteId: string | null
    isActive: boolean
    createdAt: string
    departments: { id: string; name: string } | null
    sites?: {
        id: string
        code: string
        name: string
    }
    role?: {
        id: string
        name: string
    }
    lastVersionCode?: number
    lastVersionName?: string
    lastVersionUpdate?: string
}

export default function UserList() {
    const { socket } = useSocket()
    const [users, setUsers] = useState<User[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
    const [deleteUserId, setDeleteUserId] = useState<string | null>(null)
    const [deleting, setDeleting] = useState(false)
    const [forceLogoutUserId, setForceLogoutUserId] = useState<string | null>(null)
    const [forcingLogout, setForcingLogout] = useState(false)
    const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set())

    // Pagination
    const [currentPage, setCurrentPage] = useState(1)
    const itemsPerPage = 10

    useEffect(() => {
        fetchUsers()
    }, [])

    useEffect(() => {
        if (!socket) return

        // Fetch initial online users list
        const fetchOnlineList = () => {
            socket.emit('user:get_online_users')
        }
        
        fetchOnlineList()

        // Listen for list response
        const handleOnlineList = (ids: string[]) => {
            setOnlineUsers(new Set(ids))
        }

        // Listen for individual status changes
        const handleStatusChange = (data: { userId: string, isOnline: boolean }) => {
            setOnlineUsers(prev => {
                const newSet = new Set(prev)
                if (data.isOnline) {
                    newSet.add(data.userId)
                } else {
                    newSet.delete(data.userId)
                }
                return newSet
            })
        }

        socket.on('connect', fetchOnlineList)
        socket.on('user:online_users_list', handleOnlineList)
        socket.on(SOCKET_EVENTS.USER_STATUS_CHANGE, handleStatusChange)

        return () => {
            socket.off('connect', fetchOnlineList)
            socket.off('user:online_users_list', handleOnlineList)
            socket.off(SOCKET_EVENTS.USER_STATUS_CHANGE, handleStatusChange)
        }
    }, [socket])

    const fetchUsers = async () => {
        try {
            setLoading(true)
            const res = await fetch('/api/admin/users')
            const data = await res.json()
            if (res.ok) {
                setUsers(data.users || [])
            }
        } catch (error) {
            console.error('Error fetching users:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleDelete = async (userId: string) => {
        setDeleting(true)
        try {
            const res = await fetch(`/api/admin/users/${userId}`, {
                method: 'DELETE',
            })
            if (res.ok) {
                setUsers(users.filter(u => u.id !== userId))
                setDeleteUserId(null)
            }
        } catch (error) {
            console.error('Error deleting user:', error)
        } finally {
            setDeleting(false)
        }
    }

    const handleForceLogout = async (userId: string) => {
        setForcingLogout(true)
        try {
            const res = await fetch(`/api/admin/users/${userId}/force-logout`, {
                method: 'POST',
            })
            const data = await res.json()
            if (res.ok) {
                toast.success(data.message || 'User berhasil di-logout paksa')
                setForceLogoutUserId(null)
            } else {
                toast.error(data.error || 'Gagal force logout user')
            }
        } catch (error) {
            console.error('Error force logout user:', error)
            toast.error('Terjadi kesalahan saat force logout')
        } finally {
            setForcingLogout(false)
        }
    }

    const filteredUsers = users.filter(user => {
        // Status filter
        if (statusFilter === 'active' && !user.isActive) return false
        if (statusFilter === 'inactive' && user.isActive) return false

        // Search filter
        const matchesSearch = searchTerm === '' ||
            user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.phone?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.departments?.name?.toLowerCase().includes(searchTerm.toLowerCase())

        return matchesSearch
    })

    // Pagination logic
    const totalPages = Math.ceil(filteredUsers.length / itemsPerPage)
    const startIndex = (currentPage - 1) * itemsPerPage
    const paginatedUsers = filteredUsers.slice(startIndex, startIndex + itemsPerPage)

    // Reset to page 1 when filter changes
    useEffect(() => {
        setCurrentPage(1)
    }, [searchTerm, statusFilter])

    // Statistics
    const totalUsers = users.length
    const activeUsers = users.filter(u => u.isActive).length
    const inactiveUsers = users.filter(u => !u.isActive).length

    // Define columns for ResponsiveTable
    const columns: Column<User>[] = [
        {
            key: 'name',
            header: 'Pengguna',
            priority: 'primary',
            render: (user) => (
                <div className="flex items-center gap-3">
                    <div className="relative shrink-0 h-10 w-10 rounded-full bg-linear-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                        <HiOutlineUserCircle className="w-5 h-5 text-white" />
                        {/* Online Indicator */}
                        <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white dark:border-gray-800 ${
                            onlineUsers.has(user.id) ? 'bg-green-500' : 'bg-gray-400'
                        }`} title={onlineUsers.has(user.id) ? 'Online' : 'Offline'} />
                    </div>
                    <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2">
                            {user.name || user.email.split('@')[0]}
                            {onlineUsers.has(user.id) && (
                                <span className="inline-block px-1.5 py-0.5 text-[10px] leading-none bg-green-100 text-green-700 rounded-full font-medium">
                                    Online
                                </span>
                            )}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{user.email}</div>
                    </div>
                </div>
            )
        },
        {
            key: 'phone',
            header: 'Telepon',
            priority: 'secondary',
            render: (user) => (
                <span className="text-sm text-gray-600 dark:text-gray-400">
                    {user.phone || '-'}
                </span>
            )
        },
        {
            key: 'departments',
            header: 'Departemen',
            priority: 'secondary',
            render: (user) => (
                user.departments?.name ? (
                    <span className="inline-flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400">
                        <HiOutlineBuildingOffice className="w-3.5 h-3.5 text-gray-400" />
                        {user.departments.name}
                    </span>
                ) : (
                    <span className="text-sm text-gray-400">-</span>
                )
            )
        },
        {
            key: 'role',
            header: 'Peran',
            priority: 'primary',
            render: (user) => (
                <div className="text-sm text-gray-900 dark:text-gray-100 font-medium">
                    {user.role?.name || '-'}
                </div>
            )
        },
        {
            key: 'lastVersionCode',
            header: 'App Version',
            priority: 'secondary',
            render: (user) => (
                <div className="flex flex-col">
                    <div className="flex items-center gap-1.5 text-sm text-gray-900 dark:text-gray-100">
                        <HiOutlineDevicePhoneMobile className="w-4 h-4 text-gray-400" />
                        <span>
                            {user.lastVersionName 
                                ? `v${user.lastVersionName} (Build ${user.lastVersionCode})` 
                                : user.lastVersionCode 
                                    ? `Build ${user.lastVersionCode}` 
                                    : '-'}
                        </span>
                    </div>
                    {user.lastVersionUpdate && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                            {new Date(user.lastVersionUpdate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                        </span>
                    )}
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
                    {user.isActive ? 'Aktif' : 'Nonaktif'}
                </span>
            )
        }
    ]

    // Render actions for each row
    const renderActions = (user: User) => (
        <>
            <Link
                href={`/admin/users/${user.id}?view=true`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                title="Lihat Detail"
            >
                <HiOutlineEye className="w-4 h-4" />
            </Link>
            <Link
                href={`/admin/users/${user.id}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 rounded-md hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
            >
                Edit
            </Link>
            <button
                onClick={() => setForceLogoutUserId(user.id)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 rounded-md hover:bg-orange-100 dark:hover:bg-orange-900/50 transition-colors"
                title="Force Logout"
            >
                <HiOutlineArrowRightOnRectangle className="w-4 h-4" />
            </button>
            <button
                onClick={() => setDeleteUserId(user.id)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-md hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors"
                title="Hapus"
            >
                <HiOutlineTrash className="w-4 h-4" />
            </button>
        </>
    )

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Manajemen Pengguna</h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">
                        Kelola pengguna sistem
                    </p>
                </div>
                <Link
                    href="/admin/users/new"
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
                >
                    <HiOutlinePlus className="w-5 h-5" />
                    Tambah Pengguna
                </Link>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-linear-to-r from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-5">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-500/10 rounded-lg">
                            <HiOutlineUsers className="w-7 h-7 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalUsers}</p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Total Pengguna</p>
                        </div>
                    </div>
                </div>
                <div className="bg-linear-to-r from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-5">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-green-500/10 rounded-lg">
                            <HiOutlineCheckCircle className="w-7 h-7 text-green-600 dark:text-green-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">{activeUsers}</p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Pengguna Aktif</p>
                        </div>
                    </div>
                </div>
                <div className="bg-linear-to-r from-red-50 to-red-100 dark:from-red-900/30 dark:to-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-5">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-red-500/10 rounded-lg">
                            <HiOutlineXCircle className="w-7 h-7 text-red-600 dark:text-red-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">{inactiveUsers}</p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Pengguna Nonaktif</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filters and Search */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
                <div className="flex flex-col md:flex-row gap-4">
                    {/* Search Input */}
                    <div className="relative flex-1">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <HiMagnifyingGlass className="h-5 w-5 text-gray-400" />
                        </div>
                        <input
                            type="text"
                            placeholder="Cari pengguna berdasarkan email, nama, telepon, atau departemen..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        />
                    </div>
                    {/* Status Filter */}
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <HiOutlineFunnel className="h-5 w-5 text-gray-400" />
                        </div>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
                            className="pl-10 pr-8 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        >
                            <option value="all">Semua Status</option>
                            <option value="active">Aktif</option>
                            <option value="inactive">Nonaktif</option>
                        </select>
                    </div>
                </div>
            </div>


            {/* Users List */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                {loading ? (
                    <PageLoader variant="section" message="Memuat data pengguna..." />
                ) : filteredUsers.length === 0 ? (
                    <div className="text-center py-16">
                        <div className="mx-auto w-24 h-24 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-4">
                            <HiOutlineUsers className="w-12 h-12 text-gray-400" />
                        </div>
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">Tidak ada pengguna ditemukan</h3>
                        <p className="text-gray-500 dark:text-gray-400 mb-6">
                            {searchTerm || statusFilter !== 'all' ? 'Coba ubah filter atau kata kunci pencarian Anda' : 'Mulai dengan menambahkan pengguna baru'}
                        </p>
                        <Link
                            href="/admin/users/new"
                            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors"
                        >
                            <HiOutlinePlus className="w-5 h-5" />
                            Tambah Pengguna
                        </Link>
                    </div>
                ) : (
                    <>
                        {/* Responsive Table */}
                        <ResponsiveTable
                            data={paginatedUsers}
                            columns={columns}
                            keyField="id"
                            renderActions={renderActions}
                        />

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row items-center justify-between gap-3">
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    Menampilkan {startIndex + 1} - {Math.min(startIndex + itemsPerPage, filteredUsers.length)} dari {filteredUsers.length} pengguna
                                </p>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                        disabled={currentPage === 1}
                                        className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Sebelumnya
                                    </button>
                                    <span className="text-sm text-gray-600 dark:text-gray-400">
                                        Hal {currentPage} / {totalPages}
                                    </span>
                                    <button
                                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                        disabled={currentPage === totalPages}
                                        className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Selanjutnya
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Delete Confirmation Modal */}
            {deleteUserId && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-md w-full mx-4 shadow-xl">
                        <div className="text-center">
                            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                <HiOutlineTrash className="w-8 h-8 text-red-600 dark:text-red-400" />
                            </div>
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Hapus Pengguna?</h3>
                            <p className="text-gray-600 dark:text-gray-400 mb-6">
                                Tindakan ini tidak dapat dibatalkan. Semua data terkait pengguna ini akan dihapus secara permanen.
                            </p>
                            <div className="flex items-center justify-center gap-3">
                                <button
                                    onClick={() => setDeleteUserId(null)}
                                    disabled={deleting}
                                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                                >
                                    Batal
                                </button>
                                <button
                                    onClick={() => handleDelete(deleteUserId)}
                                    disabled={deleting}
                                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                                >
                                    {deleting ? 'Menghapus...' : 'Ya, Hapus'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Force Logout Confirmation Modal */}
            {forceLogoutUserId && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-md w-full mx-4 shadow-xl">
                        <div className="text-center">
                            <div className="w-16 h-16 bg-orange-100 dark:bg-orange-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                <HiOutlineArrowRightOnRectangle className="w-8 h-8 text-orange-600 dark:text-orange-400" />
                            </div>
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Force Logout User?</h3>
                            <p className="text-gray-600 dark:text-gray-400 mb-6">
                                User ini akan di-logout paksa dari semua perangkat (Web & Mobile). User harus login ulang untuk mengakses sistem.
                            </p>
                            <div className="flex items-center justify-center gap-3">
                                <button
                                    onClick={() => setForceLogoutUserId(null)}
                                    disabled={forcingLogout}
                                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                                >
                                    Batal
                                </button>
                                <button
                                    onClick={() => handleForceLogout(forceLogoutUserId)}
                                    disabled={forcingLogout}
                                    className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50"
                                >
                                    {forcingLogout ? 'Memproses...' : 'Ya, Force Logout'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
