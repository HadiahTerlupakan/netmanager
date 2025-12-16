'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSocket, useSocketEvent } from '../SocketContext'
import { SOCKET_EVENTS, type NotificationPayload, type CountPayload } from '../types'

export interface CustomerNotification {
    id: string
    type: string
    title: string
    message: string
    preview: string
    ticketId: string
    ticketNumber: string
    ticketSubject: string
    createdAt: string
    isRead: boolean
    sender: string
}

interface UseCustomerNotificationsOptions {
    limit?: number
    autoFetch?: boolean
}

interface UseCustomerNotificationsResult {
    notifications: CustomerNotification[]
    unreadCount: number
    loading: boolean
    isConnected: boolean
    refresh: () => Promise<void>
}

/**
 * Hook for real-time customer notifications with WebSocket
 * Uses customer-specific endpoints
 */
export function useCustomerNotifications(
    options: UseCustomerNotificationsOptions = {}
): UseCustomerNotificationsResult {
    const { limit = 5, autoFetch = true } = options
    const { socket, isConnected } = useSocket()

    const [notifications, setNotifications] = useState<CustomerNotification[]>([])
    const [unreadCount, setUnreadCount] = useState(0)
    const [loading, setLoading] = useState(true)

    // Fetch notifications from customer API
    const fetchNotifications = useCallback(async () => {
        try {
            const [countRes, listRes] = await Promise.all([
                fetch('/api/customer/notifications/unread-count'),
                fetch(`/api/customer/notifications?limit=${limit}`),
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
            console.error('[CustomerNotifications] Error fetching:', error)
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
            console.log('[CustomerNotifications] New notification received:', payload.title)
            // Refetch to get full notification data with customer-specific fields
            fetchNotifications()
        },
        [fetchNotifications]
    )

    // Handle count update from WebSocket
    const handleCountUpdate = useCallback((payload: CountPayload) => {
        setUnreadCount(payload.count)
    }, [])

    // Subscribe to WebSocket events
    useSocketEvent(SOCKET_EVENTS.NOTIFICATION_NEW, handleNewNotification)
    useSocketEvent(SOCKET_EVENTS.NOTIFICATION_COUNT, handleCountUpdate)
    // Also listen for ticket replies (relevant for customer)
    useSocketEvent(SOCKET_EVENTS.TICKET_REPLY, handleNewNotification)

    return {
        notifications,
        unreadCount,
        loading,
        isConnected,
        refresh: fetchNotifications,
    }
}
