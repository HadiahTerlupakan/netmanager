'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
    HiOutlineBell,
    HiCheck,
    HiOutlineWrench,
    HiOutlineExclamationTriangle,
    HiOutlineInformationCircle,
    HiOutlineTicket
} from 'react-icons/hi2'
import { formatDistanceToNow, format } from 'date-fns'
import { id } from 'date-fns/locale'

interface Notification {
    id: string
    type: string
    priority: string
    title: string
    message: string
    link?: string
    isRead: boolean
    createdAt: string
}

type FilterType = 'ALL' | 'WORK_ORDER' | 'TICKET' | 'SYSTEM' | 'ALERT'

export default function NotificationsPage() {
    const [notifications, setNotifications] = useState<Notification[]>([])
    const [loading, setLoading] = useState(true)
    const [total, setTotal] = useState(0)
    const [page, setPage] = useState(1)
    const [activeFilter, setActiveFilter] = useState<FilterType>('ALL')
    const limit = 20

    const fetchNotifications = async () => {
        setLoading(true)
        try {
            const offset = (page - 1) * limit
            let url = `/api/notifications?limit=${limit}&offset=${offset}`
            if (activeFilter !== 'ALL') {
                url += `&type=${activeFilter}`
            }

            const res = await fetch(url)
            if (res.ok) {
                const data = await res.json()
                if (data.success) {
                    setNotifications(data.notifications)
                    setTotal(data.total)
                }
            }
        } catch (error) {
            console.error('Error fetching notifications:', error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        setPage(1)
    }, [activeFilter])

    useEffect(() => {
        fetchNotifications()
    }, [page, activeFilter])

    const markAsRead = async (notificationId: string) => {
        try {
            const res = await fetch(`/api/notifications/${notificationId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isRead: true }),
            })

            if (res.ok) {
                setNotifications((prev) =>
                    prev.map((n) => (n.id === notificationId ? { ...n, isRead: true } : n))
                )
            }
        } catch (error) {
            console.error('Error marking as read:', error)
        }
    }

    const markAllAsRead = async () => {
        try {
            const body: any = { markAllRead: true }
            if (activeFilter !== 'ALL') {
                body.type = activeFilter
            }

            const res = await fetch('/api/notifications', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            })

            if (res.ok) {
                setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
                // Optionally refresh to ensure backend state is consistent
                fetchNotifications()
            }
        } catch (error) {
            console.error('Error marking all as read:', error)
        }
    }

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'WORK_ORDER':
                return <div className="p-2 bg-blue-100 text-blue-600 rounded-lg dark:bg-blue-900/20 dark:text-blue-400"><HiOutlineWrench className="w-6 h-6" /></div>
            case 'ALERT':
                return <div className="p-2 bg-red-100 text-red-600 rounded-lg dark:bg-red-900/20 dark:text-red-400"><HiOutlineExclamationTriangle className="w-6 h-6" /></div>
            case 'TICKET':
                return <div className="p-2 bg-purple-100 text-purple-600 rounded-lg dark:bg-purple-900/20 dark:text-purple-400"><HiOutlineTicket className="w-6 h-6" /></div>
            default:
                return <div className="p-2 bg-gray-100 text-gray-600 rounded-lg dark:bg-gray-800 dark:text-gray-400"><HiOutlineInformationCircle className="w-6 h-6" /></div>
        }
    }

    const getPriorityClass = (priority: string) => {
        switch (priority) {
            case 'URGENT':
            case 'CRITICAL':
                return 'border-l-red-500 bg-red-50/50 dark:bg-red-900/5'
            case 'HIGH':
                return 'border-l-orange-500 bg-orange-50/50 dark:bg-orange-900/5'
            default:
                return 'border-l-transparent hover:bg-gray-50 dark:hover:bg-gray-800/50'
        }
    }

    const getFilterLabel = (filter: FilterType) => {
        switch (filter) {
            case 'ALL': return 'Semua'
            case 'TICKET': return 'Tiket'
            case 'WORK_ORDER': return 'Work Order'
            case 'ALERT': return 'Peringatan'
            case 'SYSTEM': return 'Sistem'
        }
    }

    const totalPages = Math.ceil(total / limit)

    return (
        <div className="p-6 max-w-5xl mx-auto space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                        <HiOutlineBell className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
                        Notifikasi
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">
                        Kelola dan lihat semua riwayat notifikasi Anda
                    </p>
                </div>

                {notifications.some(n => !n.isRead) && (
                    <button
                        onClick={markAllAsRead}
                        className="inline-flex items-center px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm whitespace-nowrap"
                    >
                        <HiCheck className="w-4 h-4 mr-2 text-green-500" />
                        {activeFilter === 'ALL' ? 'Tandai Semua Dibaca' : `Tandai Semua ${getFilterLabel(activeFilter)} Dibaca`}
                    </button>
                )}
            </div>

            {/* Filters */}
            <div className="flex overflow-x-auto pb-2 gap-2 border-b border-gray-200 dark:border-gray-800 scrollbar-thin">
                {(['ALL', 'TICKET', 'WORK_ORDER', 'SYSTEM', 'ALERT'] as FilterType[]).map((filter) => (
                    <button
                        key={filter}
                        onClick={() => setActiveFilter(filter)}
                        className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${activeFilter === filter
                                ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400'
                                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                            }`}
                    >
                        {getFilterLabel(filter)}
                    </button>
                ))}
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
                {loading && notifications.length === 0 ? (
                    <div className="p-12 text-center text-gray-500">
                        <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                        <p>Memuat notifikasi...</p>
                    </div>
                ) : notifications.length === 0 ? (
                    <div className="p-16 text-center text-gray-500 dark:text-gray-400 flex flex-col items-center">
                        <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
                            <HiOutlineBell className="w-8 h-8 text-gray-400" />
                        </div>
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">
                            {activeFilter === 'ALL' ? 'Tidak ada notifikasi' : `Tidak ada notifikasi ${getFilterLabel(activeFilter)}`}
                        </h3>
                        <p>Anda belum memiliki notifikasi untuk kategori ini.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-100 dark:divide-gray-800">
                        {notifications.map((notification) => (
                            <div
                                key={notification.id}
                                className={`p-5 transition-all duration-200 border-l-4 ${notification.isRead
                                    ? getPriorityClass(notification.priority)
                                    : 'bg-indigo-50/40 dark:bg-indigo-900/10 border-l-indigo-500'
                                    }`}
                            >
                                <div className="flex gap-4">
                                    <div className="shrink-0 pt-1">
                                        {getTypeIcon(notification.type)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-4">
                                            <div>
                                                <h4 className={`text-base font-semibold ${!notification.isRead ? 'text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'
                                                    }`}>
                                                    {notification.title}
                                                </h4>
                                                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 leading-relaxed">
                                                    {notification.message}
                                                </p>
                                            </div>
                                            <div className="flex flex-col items-end gap-2 text-right shrink-0">
                                                <span className="text-xs text-gray-500 dark:text-gray-500 whitespace-nowrap" title={format(new Date(notification.createdAt), 'dd MMM yyyy HH:mm', { locale: id })}>
                                                    {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true, locale: id })}
                                                </span>
                                                {!notification.isRead && (
                                                    <button
                                                        onClick={() => markAsRead(notification.id)}
                                                        className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 flex items-center gap-1 bg-indigo-50 dark:bg-indigo-900/20 px-2 py-1 rounded-full transition-colors"
                                                    >
                                                        <HiCheck className="w-3 h-3" />
                                                        Tandai dibaca
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {notification.link && (
                                            <div className="mt-3 flex items-center">
                                                <Link
                                                    href={notification.link}
                                                    onClick={() => !notification.isRead && markAsRead(notification.id)}
                                                    className="inline-flex items-center text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 group"
                                                >
                                                    Lihat Detail
                                                    <span className="ml-1 group-hover:translate-x-1 transition-transform">→</span>
                                                </Link>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Pagination */}
                {total > limit && (
                    <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Menampilkan <span className="font-medium">{(page - 1) * limit + 1}</span> sampai <span className="font-medium">{Math.min(page * limit, total)}</span> dari <span className="font-medium">{total}</span> notifikasi
                        </p>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1 || loading}
                                className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                Sebelumnya
                            </button>
                            <button
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page === totalPages || loading}
                                className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                Selanjutnya
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
