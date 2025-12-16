'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSocket, useSocketEvent } from '../SocketContext'
import { SOCKET_EVENTS, type NotificationPayload, type CountPayload } from '../types'

export interface Notification {
    id: string
    type: string
    priority: string
    title: string
    message: string
    link?: string
    isRead: boolean
    createdAt: string
}

interface UseRealtimeNotificationsOptions {
    limit?: number
    autoFetch?: boolean
}

interface UseRealtimeNotificationsResult {
    notifications: Notification[]
    unreadCount: number
    loading: boolean
    isConnected: boolean
    markAsRead: (notificationId: string) => Promise<void>
    markAllAsRead: () => Promise<void>
    refresh: () => Promise<void>
}

/**
 * Hook for real-time notifications with WebSocket
 */
export function useRealtimeNotifications(
    options: UseRealtimeNotificationsOptions = {}
): UseRealtimeNotificationsResult {
    const { limit = 5, autoFetch = true } = options
    const { socket, isConnected } = useSocket()

    const [notifications, setNotifications] = useState<Notification[]>([])
    const [unreadCount, setUnreadCount] = useState(0)
    const [loading, setLoading] = useState(true)

    // Fetch notifications from API
    const fetchNotifications = useCallback(async () => {
        try {
            const [countRes, listRes] = await Promise.all([
                fetch('/api/notifications/unread-count'),
                fetch(`/api/notifications?limit=${limit}`),
            ])

            if (countRes.ok) {
                const data = await countRes.json()
                setUnreadCount(data.count || 0)
            }

            if (listRes.ok) {
                const data = await listRes.json()
                setNotifications(data.notifications || [])
            }
        } catch (error) {
            console.error('[Notifications] Error fetching:', error)
        } finally {
            setLoading(false)
        }
    }, [limit])

    // Initial fetch
    useEffect(() => {
        if (autoFetch) {
            fetchNotifications()
        }
    }, [autoFetch, fetchNotifications])

    // Handle new notification from WebSocket
    const handleNewNotification = useCallback(
        (payload: NotificationPayload) => {
            console.log('[Notifications] New notification received:', payload.title)

            // Add to beginning of list
            setNotifications((prev) => {
                const newNotification: Notification = {
                    ...payload,
                    isRead: false,
                }
                return [newNotification, ...prev.slice(0, limit - 1)]
            })

            // Increment unread count
            setUnreadCount((prev) => prev + 1)
        },
        [limit]
    )

    // Handle count update from WebSocket
    const handleCountUpdate = useCallback((payload: CountPayload) => {
        setUnreadCount(payload.count)
    }, [])

    // Subscribe to WebSocket events
    useSocketEvent(SOCKET_EVENTS.NOTIFICATION_NEW, handleNewNotification)
    useSocketEvent(SOCKET_EVENTS.NOTIFICATION_COUNT, handleCountUpdate)

    // Mark single notification as read
    const markAsRead = useCallback(async (notificationId: string) => {
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
                setUnreadCount((prev) => Math.max(0, prev - 1))
            }
        } catch (error) {
            console.error('[Notifications] Error marking as read:', error)
        }
    }, [])

    // Mark all notifications as read
    const markAllAsRead = useCallback(async () => {
        try {
            const res = await fetch('/api/notifications', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ markAllRead: true }),
            })

            if (res.ok) {
                setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
                setUnreadCount(0)
            }
        } catch (error) {
            console.error('[Notifications] Error marking all as read:', error)
        }
    }, [])

    return {
        notifications,
        unreadCount,
        loading,
        isConnected,
        markAsRead,
        markAllAsRead,
        refresh: fetchNotifications,
    }
}
