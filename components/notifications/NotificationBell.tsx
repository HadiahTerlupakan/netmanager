'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { HiBell } from 'react-icons/hi2'

export function NotificationBell() {
    const [unreadCount, setUnreadCount] = useState(0)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        loadUnreadCount()
        // Poll for new notifications every 30 seconds
        const interval = setInterval(loadUnreadCount, 30000)
        return () => clearInterval(interval)
    }, [])

    const loadUnreadCount = async () => {
        try {
            // TODO: Replace with actual API call
            // Simulated data for now
            setTimeout(() => {
                setUnreadCount(0) // Reset to 0 until real API is ready
                setLoading(false)
            }, 100)
        } catch (error) {
            console.error('Error loading notification count:', error)
            setLoading(false)
        }
    }

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
        </Link>
    )
}
