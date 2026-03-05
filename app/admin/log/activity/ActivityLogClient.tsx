'use client'

import { useState, useEffect, useCallback } from 'react'
import { HiOutlineRefresh, HiOutlineClock, HiOutlineDocumentText, HiOutlineSearch } from 'react-icons/hi'
import { HiOutlineUser, HiOutlineTag } from 'react-icons/hi2'
import { Button } from '@/components/ui/Button'
import PageLoader from '@/components/ui/PageLoader'
import { format } from 'date-fns'
import { id } from 'date-fns/locale'
import ResponsiveTable from '@/components/ui/ResponsiveTable'
import { SiteFilter } from '@/components/common/SiteFilter'
import { Modal, ModalFooter } from '@/components/ui/Modal'

interface SystemLog {
    id: string
    action: string
    subject: string
    details: string | null
    createdAt: string
    user: {
        name: string | null
        email: string
    } | null
}

export function ClientComponent() {
    const [logs, setLogs] = useState<SystemLog[]>([])
    const [loading, setLoading] = useState(true)
    const [pagination, setPagination] = useState({ page: 1, limit: 20, totalPages: 1, total: 0 })
    const [selectedLog, setSelectedLog] = useState<SystemLog | null>(null)
    const [siteId, setSiteId] = useState<string | undefined>(undefined)
    const [search, setSearch] = useState('')
    const [debouncedSearch, setDebouncedSearch] = useState('')

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(search)
        }, 500)
        return () => clearTimeout(timer)
    }, [search])

    const fetchLogs = useCallback(async (page = 1) => {
        setLoading(true)
        try {
            const params = new URLSearchParams()
            params.append('type', 'ACTIVITY')
            params.append('page', page.toString())
            params.append('limit', '20')
            if (siteId) params.append('siteId', siteId)
            if (debouncedSearch) params.append('search', debouncedSearch)

            const res = await fetch(`/api/admin/system-logs?${params.toString()}`)
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
    }, [siteId, debouncedSearch])

    useEffect(() => { fetchLogs() }, [fetchLogs])

    const handlePageChange = (newPage: number) => {
        if (newPage > 0 && newPage <= pagination.totalPages) {
            fetchLogs(newPage)
        }
    }

    // Callback for PageLoader
    const renderPageLoader = useCallback(() => (
        <PageLoader variant="section" message="Memuat log aktivitas..." />
    ), []);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Log Aktivitas</h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">
                        Riwayat aktivitas perubahan data dalam sistem
                    </p>
                </div>
                <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Cari aktivitas..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-10 pr-4 py-2 w-full md:w-64 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        <HiOutlineSearch className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
                    </div>
                    <div className="w-full md:w-48">
                        <SiteFilter onSiteChange={setSiteId} resource="system_log" />
                    </div>
                    <Button onClick={() => fetchLogs(pagination.page)}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                        <HiOutlineRefresh className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                {loading && logs.length === 0 ? (
                    renderPageLoader()
                ) : logs.length === 0 ? (
                    <div className="p-12 text-center text-gray-500">
                        <HiOutlineDocumentText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                        <p>Belum ada data log aktivitas.</p>
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
                                            {format(new Date(item.createdAt), 'dd MMM yyyy HH:mm', { locale: id })}
                                        </div>
                                    )
                                },
                                {
                                    key: 'user',
                                    header: 'Pengguna',
                                    priority: 'primary',
                                    render: (item) => (
                                        <div className="flex items-center gap-2 text-sm text-gray-900 dark:text-white">
                                            <HiOutlineUser className="w-4 h-4 text-gray-400" />
                                            {item.user?.name || item.user?.email || 'System'}
                                        </div>
                                    )
                                },
                                {
                                    key: 'subject',
                                    header: 'Subjek',
                                    priority: 'secondary',
                                    render: (item) => (
                                        <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                                            <HiOutlineTag className="w-4 h-4 text-gray-400" />
                                            {item.subject}
                                        </div>
                                    )
                                },
                                {
                                    key: 'action',
                                    header: 'Aksi',
                                    priority: 'primary',
                                    render: (item) => (
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${item.action === 'CREATE' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                                            item.action === 'UPDATE' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' :
                                                item.action === 'DELETE' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' :
                                                    'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                                            }`}>
                                            {item.action}
                                        </span>
                                    )
                                },
                                {
                                    key: 'detail',
                                    header: 'Detail',
                                    priority: 'secondary',
                                    render: (item) => (
                                        <Button variant="link" onClick={() => setSelectedLog(item)}
                                            className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 hover:underline text-sm p-0 h-auto"
                                        >
                                            Lihat Detail
                                        </Button>
                                    )
                                }
                            ]}
                            emptyMessage="Belum ada data log aktivitas."
                        />

                        {/* Pagination ... (Same as Login Page) */}
                        {pagination.totalPages > 1 && (
                            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    Hal {pagination.page} dari {pagination.totalPages} ({pagination.total} Log)
                                </p>
                                <div className="flex items-center gap-2">
                                    <Button onClick={() => handlePageChange(pagination.page - 1)}
                                        disabled={pagination.page === 1}
                                        className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Sebelumnya
                                    </Button>
                                    <Button onClick={() => handlePageChange(pagination.page + 1)}
                                        disabled={pagination.page === pagination.totalPages}
                                        className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Selanjutnya
                                    </Button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Detail Modal */}
            <Modal
                isOpen={!!selectedLog}
                onClose={() => setSelectedLog(null)}
                title="Detail Log Aktivitas"
                size="2xl"
            >
                {selectedLog && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-xs text-gray-500 uppercase">Waktu</p>
                                <p className="font-medium">{format(new Date(selectedLog.createdAt), 'dd MMMM yyyy HH:mm:ss', { locale: id })}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 uppercase">Aksi</p>
                                <p className="font-medium">{selectedLog.action}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 uppercase">Subjek</p>
                                <p className="font-medium">{selectedLog.subject}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 uppercase">Pengguna</p>
                                <p className="font-medium">{selectedLog.user?.name || selectedLog.user?.email || 'System'}</p>
                            </div>
                        </div>

                        <div>
                            <p className="text-xs text-gray-500 uppercase mb-2">Detail Data</p>
                            <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg overflow-x-auto">
                                <pre className="text-xs text-gray-700 dark:text-gray-300 font-mono">
                                    {(() => {
                                        try {
                                            return JSON.stringify(JSON.parse(selectedLog.details || '{}'), null, 2)
                                        } catch {
                                            return selectedLog.details || 'Tidak ada detail tambahan'
                                        }
                                    })()}
                                </pre>
                            </div>
                        </div>
                    </div>
                )}
                <ModalFooter>
                    <Button onClick={() => setSelectedLog(null)}
                        className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                    >
                        Tutup
                    </Button>
                </ModalFooter>
            </Modal>
        </div>
    )
}
