'use client'

import { useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { useClickOutside } from '@/hooks/useClickOutside'
import { HiOutlineBell, HiCheck, HiOutlineWrench, HiOutlineExclamationTriangle, HiOutlineInformationCircle } from 'react-icons/hi2'
import { formatDistanceToNow } from 'date-fns'
import { id } from 'date-fns/locale'
import { useRealtimeNotifications } from '@/lib/websocket/hooks/useRealtimeNotifications'
import { getPriorityColor } from '@/lib/utils/priority-helpers'

export function AdminNotificationBell() {
    // const { hasPermission } = usePermission()
    const {
        notifications,
        unreadCount,
        loading,
        isConnected,
        markAsRead,
        markAllAsRead,
    } = useRealtimeNotifications({ limit: 5, excludeTypes: ['WORK_ORDER'] })

    const [isOpen, setIsOpen] = useState(false)
    const dropdownRef = useRef<HTMLDivElement>(null)

    // Close dropdown when clicking outside
    const closeDropdown = useCallback(() => setIsOpen(false), [])
    useClickOutside(dropdownRef, closeDropdown)

    // Hide if user doesn't have read access to basic notifications
    // Assuming 'dashboard:read' or basic login is enough, but some might be restricted.
    // If we want to hide it completely for some users, we can check a permission.
    // For now, let's keep it visible as system notifications are usually global.
    // But if we wanted to restrict:
    // if (!hasPermission('notifications:read')) return null;

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'WORK_ORDER':
                return <HiOutlineWrench className="w-5 h-5 text-blue-500" />
            case 'ALERT':
                return <HiOutlineExclamationTriangle className="w-5 h-5 text-red-500" />
            default:
                return <HiOutlineInformationCircle className="w-5 h-5 text-gray-500" />
        }
    }

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Bell Button */}
            <Button onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/10 rounded-full transition-all duration-200 group"
                aria-label="Notifications"
            >
                <HiOutlineBell className="w-6 h-6" />
                {!loading && unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 flex items-center justify-center min-w-[18px] h-[18px] text-[10px] font-bold text-white bg-red-500 rounded-full border-2 border-white dark:border-gray-900 group-hover:scale-110 transition-transform px-1">
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
                {/* WebSocket connection indicator */}
                {isConnected && (
                    <span className="absolute bottom-1 right-1 w-2 h-2 bg-green-500 rounded-full border border-white dark:border-gray-900" title="Real-time connected" />
                )}
            </Button>

            {/* Dropdown */}
            {isOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-100 dark:border-gray-800 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50">
                        <div className="flex items-center gap-2">
                            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Notifikasi</h3>
                            {isConnected && (
                                <span className="text-[10px] text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-1.5 py-0.5 rounded">
                                    Live
                                </span>
                            )}
                        </div>
                        {unreadCount > 0 && (
                            <Button onClick={markAllAsRead}
                                
                            >
                                <HiCheck className="w-3.5 h-3.5" />
                                Tandai semua dibaca
                            </Button>
                        )}
                    </div>

                    {/* Notification List */}
                    <div className="max-h-[400px] overflow-y-auto">
                        {notifications.length === 0 ? (
                            <div className="py-8 text-center text-gray-500 dark:text-gray-400">
                                <HiOutlineBell className="w-10 h-10 mx-auto mb-2 opacity-30" />
                                <p className="text-sm">Tidak ada notifikasi</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-50 dark:divide-gray-800">
                                {notifications.map((notification) => (
                                    <div
                                        key={notification.id}
                                        className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors border-l-4 ${getPriorityColor(notification.priority)} ${!notification.isRead ? 'bg-indigo-50/30 dark:bg-indigo-900/10' : ''
                                            }`}
                                    >
                                        <div className="flex gap-3">
                                            <div className="shrink-0 mt-0.5">
                                                {getTypeIcon(notification.type)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-start justify-between gap-2">
                                                    <p className={`text-sm font-medium truncate ${!notification.isRead ? 'text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400'}`}>
                                                        {notification.title}
                                                    </p>
                                                    {!notification.isRead && (
                                                        <Button onClick={() => markAsRead(notification.id)}
                                                            className="shrink-0 p-1 text-gray-400 hover:text-indigo-600 rounded"
                                                            title="Tandai dibaca"
                                                        >
                                                            <HiCheck className="w-4 h-4" />
                                                        </Button>
                                                    )}
                                                </div>
                                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
                                                    {notification.message}
                                                </p>
                                                <div className="flex items-center justify-between mt-2">
                                                    <span className="text-[10px] text-gray-400">
                                                        {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true, locale: id })}
                                                    </span>
                                                    {notification.link && (
                                                        <Link
                                                            href={notification.link}
                                                            onClick={() => {
                                                                markAsRead(notification.id)
                                                                setIsOpen(false)
                                                            }}
                                                            className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                                                        >
                                                            Lihat Detail →
                                                        </Link>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    {notifications.length > 0 && (
                        <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50">
                            <Link
                                href="/admin/notifications"
                                onClick={() => setIsOpen(false)}
                                className="block text-center text-sm text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
                            >
                                Lihat Semua Notifikasi
                            </Link>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
