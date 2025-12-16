'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { MdNotifications, MdChatBubble } from 'react-icons/md'
import { formatDistanceToNow } from 'date-fns'
import { id } from 'date-fns/locale'
import { useCustomerNotifications } from '@/lib/websocket/hooks/useCustomerNotifications'

export function CustomerNotificationBell() {
    const {
        notifications,
        unreadCount,
        loading,
        isConnected,
        refresh,
    } = useCustomerNotifications({ limit: 5 })

    const [isOpen, setIsOpen] = useState(false)
    const dropdownRef = useRef<HTMLDivElement>(null)

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    // Refresh when dropdown is opened
    useEffect(() => {
        if (isOpen) {
            refresh()
        }
    }, [isOpen, refresh])

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Bell Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`relative flex items-center justify-center w-10 h-10 rounded-full transition-all duration-200 ${unreadCount > 0
                    ? 'text-[#0d9488] bg-teal-50 dark:bg-teal-900/20'
                    : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                aria-label="Notifikasi"
            >
                <MdNotifications className="w-6 h-6" />
                {!loading && unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] text-[10px] font-bold text-white bg-red-500 rounded-full border-2 border-white dark:border-gray-900 animate-pulse px-1">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
                {/* WebSocket connection indicator */}
                {isConnected && (
                    <span className="absolute bottom-0.5 right-0.5 w-2 h-2 bg-green-500 rounded-full border border-white dark:border-gray-900" title="Real-time connected" />
                )}
            </button>

            {/* Dropdown */}
            {isOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-100 dark:border-gray-800 overflow-hidden z-50">
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                            <MdNotifications className="w-4 h-4 text-[#0d9488]" />
                            Notifikasi
                            {isConnected && (
                                <span className="text-[10px] text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-1.5 py-0.5 rounded">
                                    Live
                                </span>
                            )}
                        </h3>
                        {unreadCount > 0 && (
                            <span className="text-xs font-medium text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30 px-2 py-0.5 rounded-full">
                                {unreadCount} baru
                            </span>
                        )}
                    </div>

                    {/* Notification List */}
                    <div className="max-h-[300px] overflow-y-auto">
                        {notifications.length === 0 ? (
                            <div className="py-8 text-center text-gray-500 dark:text-gray-400">
                                <MdNotifications className="w-10 h-10 mx-auto mb-2 opacity-30" />
                                <p className="text-sm">Belum ada notifikasi</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-50 dark:divide-gray-800">
                                {notifications.map((notif) => (
                                    <Link
                                        key={notif.id}
                                        href={`/dukungan/${notif.ticketId}`}
                                        onClick={() => setIsOpen(false)}
                                        className={`block p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${!notif.isRead ? 'bg-teal-50/50 dark:bg-teal-900/10' : ''
                                            }`}
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className={`p-2 rounded-full ${!notif.isRead
                                                ? 'bg-[#0d9488]/10 text-[#0d9488]'
                                                : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
                                                }`}>
                                                <MdChatBubble className="w-4 h-4" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-0.5">
                                                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                                                        {notif.title}
                                                    </span>
                                                    {!notif.isRead && (
                                                        <span className="w-2 h-2 bg-[#0d9488] rounded-full" />
                                                    )}
                                                </div>
                                                <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                                                    {notif.ticketSubject}
                                                </p>
                                                <p className="text-xs text-gray-500 dark:text-gray-500 mt-1 line-clamp-2">
                                                    {notif.preview}
                                                </p>
                                                <p className="text-[10px] text-gray-400 mt-1">
                                                    {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true, locale: id })}
                                                </p>
                                            </div>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    {notifications.length > 0 && (
                        <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50">
                            <Link
                                href="/dukungan/riwayat"
                                onClick={() => setIsOpen(false)}
                                className="block text-center text-sm text-[#0d9488] hover:underline font-medium"
                            >
                                Lihat Semua Tiket →
                            </Link>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
