'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import {
    HiBell,
    HiCheckCircle,
    HiXCircle,
    HiInformationCircle,
    HiExclamationTriangle,
    HiClock
} from 'react-icons/hi2'
import Link from 'next/link'

// Notification types
type NotificationType = 'work_order' | 'ticket' | 'system' | 'alert'
type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent'

interface Notification {
    id: string
    type: NotificationType
    priority: NotificationPriority
    title: string
    message: string
    read: boolean
    link?: string
    createdAt: Date
}

export default function NotificationsPage() {
    const { data: session } = useSession()
    const [notifications, setNotifications] = useState<Notification[]>([])
    const [filter, setFilter] = useState<'all' | 'unread'>('all')
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        loadNotifications()
    }, [])

    const loadNotifications = async () => {
        setLoading(true)
        try {
            // TODO: Replace with actual API call
            // Simulated data for now
            setTimeout(() => {
                const mockNotifications: Notification[] = [
                    {
                        id: '1',
                        type: 'work_order',
                        priority: 'high',
                        title: 'New Work Order Assigned',
                        message: 'Work Order #WO-20241130-001 has been assigned to your department (IT)',
                        read: false,
                        link: '/employee/workorders',
                        createdAt: new Date(Date.now() - 3600000) // 1 hour ago
                    },
                    {
                        id: '2',
                        type: 'work_order',
                        priority: 'urgent',
                        title: 'Urgent: Installation Required',
                        message: 'Customer installation at Jl. Sudirman requires immediate attention',
                        read: false,
                        link: '/employee/workorders',
                        createdAt: new Date(Date.now() - 7200000) // 2 hours ago
                    },
                    {
                        id: '3',
                        type: 'system',
                        priority: 'normal',
                        title: 'Attendance Reminder',
                        message: 'Don\'t forget to check out at the end of your shift',
                        read: true,
                        link: '/employee/attendance',
                        createdAt: new Date(Date.now() - 86400000) // 1 day ago
                    },
                ]
                setNotifications(mockNotifications)
                setLoading(false)
            }, 500)
        } catch (error) {
            console.error('Error loading notifications:', error)
            setLoading(false)
        }
    }

    const markAsRead = async (notificationId: string) => {
        // TODO: API call to mark as read
        setNotifications(prev =>
            prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
        )
    }

    const markAllAsRead = async () => {
        // TODO: API call to mark all as read
        setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    }

    const deleteNotification = async (notificationId: string) => {
        // TODO: API call to delete
        setNotifications(prev => prev.filter(n => n.id !== notificationId))
    }

    const getIcon = (type: NotificationType, priority: NotificationPriority) => {
        if (priority === 'urgent') return <HiExclamationTriangle className="w-6 h-6 text-red-600" />
        if (priority === 'high') return <HiExclamationTriangle className="w-6 h-6 text-orange-600" />

        switch (type) {
            case 'work_order':
                return <HiBell className="w-6 h-6 text-blue-600" />
            case 'ticket':
                return <HiInformationCircle className="w-6 h-6 text-purple-600" />
            case 'alert':
                return <HiExclamationTriangle className="w-6 h-6 text-yellow-600" />
            default:
                return <HiInformationCircle className="w-6 h-6 text-gray-600" />
        }
    }

    const formatTime = (date: Date) => {
        const now = new Date()
        const diff = now.getTime() - date.getTime()
        const minutes = Math.floor(diff / 60000)
        const hours = Math.floor(diff / 3600000)
        const days = Math.floor(diff / 86400000)

        if (minutes < 1) return 'Just now'
        if (minutes < 60) return `${minutes}m ago`
        if (hours < 24) return `${hours}h ago`
        if (days < 7) return `${days}d ago`
        return date.toLocaleDateString()
    }

    const filteredNotifications = filter === 'unread'
        ? notifications.filter(n => !n.read)
        : notifications

    const unreadCount = notifications.filter(n => !n.read).length

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">
                        Notifications
                    </h1>
                    <p className="text-base sm:text-sm text-gray-600 dark:text-gray-400">
                        {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
                    </p>
                </div>
                {unreadCount > 0 && (
                    <button
                        onClick={markAllAsRead}
                        className="w-full sm:w-auto px-4 py-3 sm:py-2 min-h-[44px] text-base sm:text-sm font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 touch-manipulation rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
                    >
                        Mark all as read
                    </button>
                )}
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
                    All ({notifications.length})
                </button>
                <button
                    onClick={() => setFilter('unread')}
                    className={`px-4 py-3 sm:py-2 min-h-[44px] font-medium border-b-2 transition-colors touch-manipulation text-base sm:text-sm ${filter === 'unread'
                            ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                            : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                        }`}
                >
                    Unread ({unreadCount})
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
                            No notifications
                        </h3>
                        <p className="text-gray-600 dark:text-gray-400">
                            {filter === 'unread' ? "You're all caught up!" : "You don't have any notifications yet"}
                        </p>
                    </div>
                ) : (
                    filteredNotifications.map((notification) => (
                        <div
                            key={notification.id}
                            className={`bg-white dark:bg-gray-800 rounded-xl shadow hover:shadow-md transition-shadow p-5 sm:p-4 ${!notification.read ? 'border-l-4 border-indigo-600' : ''
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
                                        <h3 className={`font-semibold text-base sm:text-sm ${!notification.read
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
                                                className="text-base sm:text-sm font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 touch-manipulation min-h-[44px] flex items-center"
                                            >
                                                View →
                                            </Link>
                                        )}
                                        {!notification.read && (
                                            <button
                                                onClick={() => markAsRead(notification.id)}
                                                className="text-base sm:text-sm font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200 touch-manipulation min-h-[44px] flex items-center"
                                            >
                                                Mark as read
                                            </button>
                                        )}
                                        <button
                                            onClick={() => deleteNotification(notification.id)}
                                            className="text-base sm:text-sm font-medium text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 touch-manipulation min-h-[44px] flex items-center"
                                        >
                                            Delete
                                        </button>
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
