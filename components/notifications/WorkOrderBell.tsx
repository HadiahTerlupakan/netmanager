'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { HiCheck, HiOutlineWrench, HiOutlineClipboardDocumentList } from 'react-icons/hi2'
import { formatDistanceToNow } from 'date-fns'
import { id } from 'date-fns/locale'
import { Button } from '@/components/ui/Button'
import { useRealtimeWorkOrders } from '@/lib/websocket/hooks/useRealtimeWorkOrders'
import { usePermission } from '@/hooks/use-permission'
import { getPriorityColor } from '@/lib/utils/priority-helpers'
import { useClickOutside } from '@/hooks/useClickOutside'

export function WorkOrderBell() {
    const { hasPermission } = usePermission()
    const {
        notifications,
        unreadCount,
        loading,
        isConnected,
        markAsRead,
        markAllAsRead,
        refresh
    } = useRealtimeWorkOrders({
        limit: 5,
        enabled: hasPermission('workorders:read')
    })

    const [isOpen, setIsOpen] = useState(false)
    const dropdownRef = useRef<HTMLDivElement>(null)

    // Close dropdown when clicking outside
    const closeDropdown = useCallback(() => setIsOpen(false), [])
    useClickOutside(dropdownRef, closeDropdown)

    // Refresh when dropdown is opened to ensure data is fresh
    useEffect(() => {
        if (isOpen) {
            refresh()
        }
    }, [isOpen, refresh])

    // Hide if no work order permission
    if (!hasPermission('workorders:read')) {
        return null
    }

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Wrench Button */}
            <Button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/10 rounded-full transition-all duration-200 group"
                aria-label="Work Order Notifications"
                title="Notifikasi Work Order"
            >
                <HiOutlineClipboardDocumentList className="w-6 h-6" />
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
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800 bg-blue-50/50 dark:bg-blue-900/20">
                        <div className="flex items-center gap-2">
                            <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                                <HiOutlineWrench className="w-4 h-4 text-blue-600" />
                                Work Orders
                            </h3>
                            {isConnected && (
                                <span className="text-[10px] text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-1.5 py-0.5 rounded">
                                    Live
                                </span>
                            )}
                        </div>
                        {unreadCount > 0 && (
                            <Button
                                onClick={markAllAsRead}
                                
                            >
                                <HiCheck className="w-3.5 h-3.5" />
                                Tandai dibaca
                            </Button>
                        )}
                    </div>

                    {/* Notification List */}
                    <div className="max-h-[400px] overflow-y-auto">
                        {notifications.length === 0 ? (
                            <div className="py-8 text-center text-gray-500 dark:text-gray-400">
                                <HiOutlineClipboardDocumentList className="w-10 h-10 mx-auto mb-2 opacity-30" />
                                <p className="text-sm">Tidak ada notifikasi WO</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-50 dark:divide-gray-800">
                                {notifications.map((notification) => (
                                    <div
                                        key={notification.id}
                                        className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors border-l-4 ${getPriorityColor(notification.priority, 'border-l-blue-500')} ${!notification.isRead ? 'bg-blue-50/30 dark:bg-blue-900/10' : ''
                                            }`}
                                    >
                                        <div className="flex gap-3">
                                            <div className="shrink-0 mt-0.5">
                                                <HiOutlineWrench className="w-5 h-5 text-blue-500" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-start justify-between gap-2">
                                                    <p className={`text-sm font-medium truncate ${!notification.isRead ? 'text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400'}`}>
                                                        {notification.title}
                                                    </p>
                                                    {!notification.isRead && (
                                                        <Button
                                                            onClick={() => markAsRead(notification.id)}
                                                            className="shrink-0 p-1 text-gray-400 hover:text-blue-600 rounded"
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
                                                            className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
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
                                href="/admin/workorders/list"
                                onClick={() => setIsOpen(false)}
                                className="block text-center text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium"
                            >
                                Lihat Semua Work Order
                            </Link>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
