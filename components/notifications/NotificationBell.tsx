'use client'

import Link from 'next/link'
import { HiBell } from 'react-icons/hi2'
import { useRealtimeNotifications } from '@/lib/websocket/hooks/useRealtimeNotifications'

export function NotificationBell() {
    const { unreadCount, loading, isConnected } = useRealtimeNotifications({ limit: 5 })

    return (
        <Link
            href="/employee/notifications"
            className="relative p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
            aria-label="View notifications"
        >
            <HiBell className="w-6 h-6" />
            {!loading && unreadCount > 0 && (
                <span className="absolute top-0 right-0 inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-600 rounded-full">
                    {unreadCount > 9 ? '9+' : unreadCount}
                </span>
            )}
            {/* WebSocket connection indicator */}
            {isConnected && (
                <span className="absolute bottom-0.5 right-0.5 w-2 h-2 bg-green-500 rounded-full border border-white dark:border-gray-700" title="Real-time connected" />
            )}
        </Link>
    )
}
