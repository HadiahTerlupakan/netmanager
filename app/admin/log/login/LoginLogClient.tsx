'use client'

import { useState, useEffect } from 'react'
import { HiOutlineRefresh } from 'react-icons/hi'
import { HiOutlineClock, HiXMark, HiOutlineShieldCheck, HiOutlineUser, HiOutlineEye } from 'react-icons/hi2'
import PageLoader from '@/components/ui/PageLoader'
import { format } from 'date-fns'
import { id } from 'date-fns/locale'
import ResponsiveTable from '@/components/ui/ResponsiveTable'

interface SystemLog {
    id: string
    action: string
    details: string | null
    createdAt: string
    user: {
        name: string | null
        email: string
    } | null
    ipAddress: string | null
    userAgent: string | null
}

interface LogDetails {
    email?: string
    name?: string
    role?: string
    portal?: string
    provider?: string
    isNewUser?: boolean
    loginTime?: string
    [key: string]: string | boolean | undefined
}

export function ClientComponent() {
    const [logs, setLogs] = useState<SystemLog[]>([])
    const [loading, setLoading] = useState(true)
    const [pagination, setPagination] = useState({ page: 1, limit: 20, totalPages: 1, total: 0 })
    const [selectedLog, setSelectedLog] = useState<SystemLog | null>(null)
    const [showModal, setShowModal] = useState(false)

    const fetchLogs = async (page = 1) => {
        setLoading(true)
        try {
            const res = await fetch(`/api/admin/system-logs?type=AUTH&page=${page}&limit=20`)
            const data = await res.json()
            if (res.ok) {
                const responseData = data.data || data
                setLogs(responseData.logs || [])
                setPagination(responseData.pagination || { page: 1, limit: 20, totalPages: 1, total: 0 })
            }
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { fetchLogs() }, [])

    const handlePageChange = (newPage: number) => {
        if (newPage > 0 && newPage <= pagination.totalPages) {
            fetchLogs(newPage)
        }
    }

    const openDetail = (log: SystemLog) => {
        setSelectedLog(log)
        setShowModal(true)
    }

    const parseDetails = (details: string | null): LogDetails => {
        if (!details) return {}
        try {
            return JSON.parse(details)
        } catch {
            return {}
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Log Login</h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">
                        Riwayat aktivitas login pengguna ke sistem
                    </p>
                </div>
                <button
                    onClick={() => fetchLogs(pagination.page)}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                    <HiOutlineRefresh className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                </button>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                {loading && logs.length === 0 ? (
                    <PageLoader variant="section" message="Memuat log login..." />
                ) : logs.length === 0 ? (
                    <div className="p-12 text-center text-gray-500">
                        <HiOutlineShieldCheck className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                        <p>Belum ada data log login.</p>
                    </div>
                ) : (
                    <>
                        <ResponsiveTable
                            data={logs}
                            loading={loading}
                            keyField="id"
                            columns={[
                                {
                                    key: 'createdAt',
                                    header: 'Waktu',
                                    priority: 'primary',
                                    render: (item) => (
                                        <div className="flex items-center gap-2">
                                            <HiOutlineClock className="w-4 h-4 text-gray-400" />
                                            {format(new Date(item.createdAt), 'dd MMM yyyy HH:mm:ss', { locale: id })}
                                        </div>
                                    )
                                },
                                {
                                    key: 'user',
                                    header: 'Pengguna',
                                    priority: 'primary',
                                    render: (item) => (
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center">
                                                <HiOutlineUser className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                                            </div>
                                            <div>
                                                <div className="text-sm font-medium text-gray-900 dark:text-white">
                                                    {item.user?.name || '-'}
                                                </div>
                                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                                    {item.user?.email || '-'}
                                                </div>
                                            </div>
                                        </div>
                                    )
                                },
                                {
                                    key: 'action',
                                    header: 'Aksi',
                                    priority: 'primary',
                                    render: (item) => (
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                                            {item.action}
                                        </span>
                                    )
                                },
                                {
                                    key: 'detail',
                                    header: 'Detail',
                                    priority: 'secondary',
                                    render: (item) => (
                                        <button
                                            onClick={() => openDetail(item)}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
                                        >
                                            <HiOutlineEye className="w-4 h-4" />
                                            Lihat Detail
                                        </button>
                                    )
                                }
                            ]}
                            emptyMessage="Belum ada data log login."
                        />

                        {/* Pagination */}
                        {pagination.totalPages > 1 && (
                            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    Hal {pagination.page} dari {pagination.totalPages} ({pagination.total} Log)
                                </p>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => handlePageChange(pagination.page - 1)}
                                        disabled={pagination.page === 1}
                                        className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Sebelumnya
                                    </button>
                                    <button
                                        onClick={() => handlePageChange(pagination.page + 1)}
                                        disabled={pagination.page === pagination.totalPages}
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

            {/* Detail Modal */}
            {showModal && selectedLog && (
                <div className="fixed inset-0 z-50 overflow-y-auto">
                    <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
                        <div 
                            className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity"
                            onClick={() => setShowModal(false)}
                        />
                        
                        <div className="relative inline-block w-full max-w-lg p-6 overflow-hidden text-left align-middle transition-all transform bg-white dark:bg-gray-800 rounded-2xl shadow-xl">
                            {/* Header */}
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center">
                                        <HiOutlineShieldCheck className="w-5 h-5 text-green-600 dark:text-green-400" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                            Detail Log Login
                                        </h3>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">
                                            {format(new Date(selectedLog.createdAt), 'dd MMM yyyy HH:mm:ss', { locale: id })}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setShowModal(false)}
                                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                >
                                    <HiXMark className="w-5 h-5 text-gray-500" />
                                </button>
                            </div>

                            {/* Content */}
                            <div className="space-y-4">
                                {(() => {
                                    const details = parseDetails(selectedLog.details)
                                    return (
                                        <>
                                            {/* User Info */}
                                            <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl space-y-3">
                                                <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                    Informasi Pengguna
                                                </h4>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <p className="text-xs text-gray-500 dark:text-gray-400">Nama</p>
                                                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                                                            {details.name || selectedLog.user?.name || '-'}
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-gray-500 dark:text-gray-400">Email</p>
                                                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                                                            {details.email || selectedLog.user?.email || '-'}
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-gray-500 dark:text-gray-400">Role</p>
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300">
                                                            {details.role || '-'}
                                                        </span>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-gray-500 dark:text-gray-400">Portal</p>
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300">
                                                            {details.portal || '-'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Login Info */}
                                            <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl space-y-3">
                                                <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                    Informasi Login
                                                </h4>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <p className="text-xs text-gray-500 dark:text-gray-400">Provider</p>
                                                        <p className="text-sm font-medium text-gray-900 dark:text-white capitalize">
                                                            {details.provider || '-'}
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-gray-500 dark:text-gray-400">Status</p>
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300">
                                                            {selectedLog.action}
                                                        </span>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-gray-500 dark:text-gray-400">User Baru</p>
                                                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                                                            {details.isNewUser ? 'Ya' : 'Tidak'}
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-gray-500 dark:text-gray-400">Waktu Login</p>
                                                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                                                            {details.loginTime ? format(new Date(details.loginTime), 'HH:mm:ss', { locale: id }) : '-'}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Technical Info */}
                                            {(selectedLog.ipAddress || selectedLog.userAgent) && (
                                                <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl space-y-3">
                                                    <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                        Informasi Teknis
                                                    </h4>
                                                    {selectedLog.ipAddress && (
                                                        <div>
                                                            <p className="text-xs text-gray-500 dark:text-gray-400">IP Address</p>
                                                            <p className="text-sm font-mono text-gray-900 dark:text-white">
                                                                {selectedLog.ipAddress}
                                                            </p>
                                                        </div>
                                                    )}
                                                    {selectedLog.userAgent && (
                                                        <div>
                                                            <p className="text-xs text-gray-500 dark:text-gray-400">User Agent</p>
                                                            <p className="text-sm font-mono text-gray-900 dark:text-white break-all">
                                                                {selectedLog.userAgent}
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </>
                                    )
                                })()}
                            </div>

                            {/* Footer */}
                            <div className="mt-6 flex justify-end">
                                <button
                                    onClick={() => setShowModal(false)}
                                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                                >
                                    Tutup
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

