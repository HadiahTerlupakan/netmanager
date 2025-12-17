'use client'

import { useState, useEffect } from 'react'
import { HiOutlineRefresh, HiOutlineClock, HiOutlineDocumentText } from 'react-icons/hi'
import { HiOutlineUser, HiOutlineTag } from 'react-icons/hi2'
import PageLoader from '@/components/ui/PageLoader'
import { format } from 'date-fns'
import { id } from 'date-fns/locale'

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

export default function ActivityLogPage() {
    const [logs, setLogs] = useState<SystemLog[]>([])
    const [loading, setLoading] = useState(true)
    const [pagination, setPagination] = useState({ page: 1, limit: 20, totalPages: 1, total: 0 })
    const [selectedLog, setSelectedLog] = useState<SystemLog | null>(null)

    const fetchLogs = async (page = 1) => {
        setLoading(true)
        try {
            const res = await fetch(`/api/admin/system-logs?type=ACTIVITY&page=${page}&limit=20`)
            const data = await res.json()
            if (res.ok) {
                setLogs(data.logs)
                setPagination(data.pagination)
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

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Log Aktivitas</h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">
                        Riwayat aktivitas perubahan data dalam sistem
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
                    <PageLoader variant="section" message="Memuat log aktivitas..." />
                ) : logs.length === 0 ? (
                    <div className="p-12 text-center text-gray-500">
                        <HiOutlineDocumentText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                        <p>Belum ada data log aktivitas.</p>
                    </div>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                                    <tr>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                                            Waktu
                                        </th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                                            Pengguna
                                        </th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                                            Subjek
                                        </th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                                            Aksi
                                        </th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                                            Detail
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-800">
                                    {logs.map((log) => (
                                        <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                                                <div className="flex items-center gap-2">
                                                    <HiOutlineClock className="w-4 h-4 text-gray-400" />
                                                    {format(new Date(log.createdAt), 'dd MMM yyyy HH:mm', { locale: id })}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center gap-2 text-sm text-gray-900 dark:text-white">
                                                    <HiOutlineUser className="w-4 h-4 text-gray-400" />
                                                    {log.user?.name || log.user?.email || 'System'}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                                                    <HiOutlineTag className="w-4 h-4 text-gray-400" />
                                                    {log.subject}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${log.action === 'CREATE' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                                                        log.action === 'UPDATE' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' :
                                                            log.action === 'DELETE' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' :
                                                                'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                                                    }`}>
                                                    {log.action}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                                                <button
                                                    onClick={() => setSelectedLog(log)}
                                                    className="text-indigo-600 dark:text-indigo-400 hover:underline"
                                                >
                                                    Lihat Detail
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination ... (Same as Login Page) */}
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
            {selectedLog && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-xl max-w-2xl w-full shadow-xl max-h-[80vh] overflow-y-auto">
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Detail Log Aktivitas</h3>
                                <button onClick={() => setSelectedLog(null)} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                                    <span className="sr-only">Close</span>
                                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

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

                            <div className="mt-6 flex justify-end">
                                <button
                                    onClick={() => setSelectedLog(null)}
                                    className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
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
