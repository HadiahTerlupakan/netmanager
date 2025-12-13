'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import {
    HiBell,
    HiCheckCircle,
    HiXCircle,
    HiInformationCircle,
    HiExclamationTriangle,
    HiClock,
    HiArrowPath
} from 'react-icons/hi2'
import Link from 'next/link'
import { useEmployeePermissions } from '@/components/providers/EmployeePermissionContext'
import { PushNotificationManager } from '@/components/notifications/PushNotificationManager'

// Notification types
type NotificationType = 'WORK_ORDER' | 'TICKET' | 'SYSTEM' | 'ALERT'
type NotificationPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'

interface Notification {
    id: string
    type: NotificationType
    priority: NotificationPriority
    title: string
    message: string
    isRead: boolean
    link?: string
    createdAt: string
    readAt?: string
    sourceType?: string
    sourceId?: string
}

export default function NotificationsPage() {
    const { data: session } = useSession()
    const { hasFeature } = useEmployeePermissions()
    const [notifications, setNotifications] = useState<Notification[]>([])
    const [filter, setFilter] = useState<'all' | 'unread'>('all')
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)

    const loadNotifications = useCallback(async () => {
        try {
            const response = await fetch(`/api/notifications?unread=${filter === 'unread'}`)
            if (response.ok) {
                const data = await response.json()
                // Filter notifications based on permissions
                const allowedNotifications = (data.notifications || []).filter((notification: Notification) => {
                    if (notification.type === 'WORK_ORDER') {
                        return hasFeature('WORKORDERS')
                    }
                    return true
                })
                setNotifications(allowedNotifications)
            }
        } catch (error) {
            console.error('Error loading notifications:', error)
        } finally {
            setLoading(false)
            setRefreshing(false)
        }
    }, [filter, hasFeature])

    useEffect(() => {
        loadNotifications()
    }, [loadNotifications])

    const refreshNotifications = () => {
        setRefreshing(true)
        loadNotifications()
    }

    const markAsRead = async (notificationId: string) => {
        try {
            await fetch(`/api/notifications/${notificationId}/read`, {
                method: 'PATCH',
            })
            setNotifications(prev =>
                prev.map(n => n.id === notificationId ? { ...n, isRead: true, readAt: new Date().toISOString() } : n)
            )
        } catch (error) {
            console.error('Error marking notification as read:', error)
        }
    }

    const markAllAsRead = async () => {
        try {
            await fetch('/api/notifications', {
                method: 'PATCH',
            })
            setNotifications(prev => prev.map(n => ({ ...n, isRead: true, readAt: new Date().toISOString() })))
        } catch (error) {
            console.error('Error marking all notifications as read:', error)
        }
    }

    const getIcon = (type: NotificationType, priority: NotificationPriority) => {
        if (priority === 'URGENT') return <HiExclamationTriangle className="w-6 h-6 text-red-600" />
        if (priority === 'HIGH') return <HiExclamationTriangle className="w-6 h-6 text-orange-600" />

        switch (type) {
            case 'WORK_ORDER':
                return <HiBell className="w-6 h-6 text-blue-600" />
            case 'TICKET':
                return <HiInformationCircle className="w-6 h-6 text-purple-600" />
            case 'ALERT':
                return <HiExclamationTriangle className="w-6 h-6 text-yellow-600" />
            default:
                return <HiInformationCircle className="w-6 h-6 text-gray-600" />
        }
    }

    const formatTime = (dateString: string) => {
        const date = new Date(dateString)
        const now = new Date()
        const diff = now.getTime() - date.getTime()
        const minutes = Math.floor(diff / 60000)
        const hours = Math.floor(diff / 3600000)
        const days = Math.floor(diff / 86400000)

        if (minutes < 1) return 'Baru saja'
        if (minutes < 60) return `${minutes} menit lalu`
        if (hours < 24) return `${hours} jam lalu`
        if (days < 7) return `${days} hari lalu`
        return date.toLocaleDateString('id-ID')
    }

    const filteredNotifications = filter === 'unread'
        ? notifications.filter(n => !n.isRead)
        : notifications

    const unreadCount = notifications.filter(n => !n.isRead).length

    return (
        <div className="space-y-6">
            {/* Push Notification Banner */}
            <PushNotificationManager />

            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">
                        Notifikasi
                    </h1>
                    <p className="text-base sm:text-sm text-gray-600 dark:text-gray-400">
                        {unreadCount} notifikasi belum dibaca
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={refreshNotifications}
                        disabled={refreshing}
                        className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50"
                        aria-label="Refresh"
                    >
                        <HiArrowPath className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
                    </button>
                    {unreadCount > 0 && (
                        <button
                            onClick={markAllAsRead}
                            className="px-4 py-2 text-sm font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
                        >
                            Tandai semua sudah dibaca
                        </button>
                    )}
                </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
                <button
                    onClick={() => setFilter('all')}
                    className={`px-4 py-3 sm:py-2 min-h-[44px] font-medium border-b-2 transition-colors touch-manipulation text-base sm:text-sm ${filter === 'all'
                        ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                        : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                        }`}
                >
                    Semua ({notifications.length})
                </button>
                <button
                    onClick={() => setFilter('unread')}
                    className={`px-4 py-3 sm:py-2 min-h-[44px] font-medium border-b-2 transition-colors touch-manipulation text-base sm:text-sm ${filter === 'unread'
                        ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                        : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                        }`}
                >
                    Belum Dibaca ({unreadCount})
                </button>
            </div>

            {/* Notifications List */}
            <div className="space-y-2">
                {loading ? (
                    // Loading skeletons
                    Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="bg-white dark:bg-gray-800 rounded-xl shadow p-4 animate-pulse">
                            <div className="flex items-start gap-4">
                                <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
                                <div className="flex-1 space-y-2">
                                    <div className="h-4 w-3/4 bg-gray-200 dark:bg-gray-700 rounded"></div>
                                    <div className="h-3 w-full bg-gray-200 dark:bg-gray-700 rounded"></div>
                                </div>
                            </div>
                        </div>
                    ))
                ) : filteredNotifications.length === 0 ? (
                    // Empty state
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-12 text-center">
                        <HiBell className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                            Tidak ada notifikasi
                        </h3>
                        <p className="text-gray-600 dark:text-gray-400">
                            {filter === 'unread' ? "Semua notifikasi sudah dibaca!" : "Belum ada notifikasi"}
                        </p>
                    </div>
                ) : (
                    filteredNotifications.map((notification) => (
                        <div
                            key={notification.id}
                            className={`bg-white dark:bg-gray-800 rounded-xl shadow hover:shadow-md transition-shadow p-5 sm:p-4 ${!notification.isRead ? 'border-l-4 border-indigo-600' : ''
                                }`}
                        >
                            <div className="flex items-start gap-4">
                                {/* Icon */}
                                <div className="flex-shrink-0 mt-1">
                                    {getIcon(notification.type, notification.priority)}
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-2">
                                        <h3 className={`font-semibold text-base sm:text-sm ${!notification.isRead
                                            ? 'text-gray-900 dark:text-white'
                                            : 'text-gray-700 dark:text-gray-300'
                                            }`}>
                                            {notification.title}
                                        </h3>
                                        <span className="text-sm sm:text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap flex items-center gap-1">
                                            <HiClock className="w-4 h-4 sm:w-3 sm:h-3" />
                                            {formatTime(notification.createdAt)}
                                        </span>
                                    </div>
                                    <p className="text-base sm:text-sm text-gray-600 dark:text-gray-400 mt-1 leading-relaxed">
                                        {notification.message}
                                    </p>

                                    {/* Actions */}
                                    <div className="flex flex-wrap items-center gap-3 sm:gap-4 mt-4 sm:mt-3">
                                        {notification.link && (
                                            <Link
                                                href={notification.link}
                                                onClick={() => !notification.isRead && markAsRead(notification.id)}
                                                className="text-base sm:text-sm font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 touch-manipulation min-h-[44px] flex items-center"
                                            >
                                                Lihat →
                                            </Link>
                                        )}
                                        {!notification.isRead && (
                                            <button
                                                onClick={() => markAsRead(notification.id)}
                                                className="text-base sm:text-sm font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200 touch-manipulation min-h-[44px] flex items-center"
                                            >
                                                Tandai sudah dibaca
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}
