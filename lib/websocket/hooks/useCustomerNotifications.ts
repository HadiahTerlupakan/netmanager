'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSocket, useSocketEvent } from '../SocketContext'
import { SOCKET_EVENTS, type NotificationPayload } from '../types'

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

export interface CustomerAnnouncement {
    id: string
    title: string
    content: string
    isPinned: boolean
    createdAt: string
}

interface UseCustomerNotificationsOptions {
    limit?: number
    autoFetch?: boolean
}

interface UseCustomerNotificationsResult {
    notifications: CustomerNotification[]
    announcements: CustomerAnnouncement[]
    unreadCount: number
    unreadTicketCount: number
    unreadAnnouncementCount: number
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
    const { isConnected } = useSocket()

    const [notifications, setNotifications] = useState<CustomerNotification[]>([])
    const [announcements, setAnnouncements] = useState<CustomerAnnouncement[]>([])
    const [unreadCount, setUnreadCount] = useState(0)
    const [unreadTicketCount, setUnreadTicketCount] = useState(0)
    const [unreadAnnouncementCount, setUnreadAnnouncementCount] = useState(0)
    const [loading, setLoading] = useState(true)

    // Fetch notifications from customer API
    const fetchNotifications = useCallback(async () => {
        try {
            const response = await fetch(`/api/customer/notifications?limit=${limit}`)

            if (response.ok) {
                const data = await response.json()
                setUnreadCount(data.unreadCount || 0)
                setUnreadTicketCount(data.unreadTicketCount || 0)
                setUnreadAnnouncementCount(data.unreadAnnouncementCount || 0)
                setNotifications(data.notifications || [])
                setAnnouncements(data.announcements || [])
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

    // Subscribe to WebSocket events
    useSocketEvent(SOCKET_EVENTS.ANNOUNCEMENT_NEW, handleNewNotification)
    useSocketEvent(SOCKET_EVENTS.TICKET_MESSAGE, handleNewNotification)
    useSocketEvent(SOCKET_EVENTS.TICKET_REPLY, handleNewNotification)

    return {
        notifications,
        announcements,
        unreadCount,
        unreadTicketCount,
        unreadAnnouncementCount,
        loading,
        isConnected,
        refresh: fetchNotifications,
    }
}
