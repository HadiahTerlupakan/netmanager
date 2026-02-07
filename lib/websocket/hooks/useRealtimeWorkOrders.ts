'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSocket, useSocketEvent } from '../SocketContext'
import { SOCKET_EVENTS, type NotificationPayload } from '../types'
import { usePermission } from '@/hooks/use-permission'

export interface WorkOrderNotification {
    id: string
    type: string
    priority: string
    title: string
    message: string
    link?: string
    isRead: boolean
    createdAt: string
}

interface UseRealtimeWorkOrdersOptions {
    limit?: number
    autoFetch?: boolean
    enabled?: boolean
}

interface UseRealtimeWorkOrdersResult {
    notifications: WorkOrderNotification[]
    unreadCount: number
    loading: boolean
    isConnected: boolean
    markAsRead: (notificationId: string) => Promise<void>
    markAllAsRead: () => Promise<void>
    refresh: () => Promise<void>
}

/**
 * Hook for real-time Work Order notifications
 */
export function useRealtimeWorkOrders(
    options: UseRealtimeWorkOrdersOptions = {}
): UseRealtimeWorkOrdersResult {
    const { limit = 5, autoFetch = true, enabled = true } = options
    const { isConnected } = useSocket()
    const { hasPermission, isLoading: isPermissionLoading } = usePermission()

    const [notifications, setNotifications] = useState<WorkOrderNotification[]>([])
    const [unreadCount, setUnreadCount] = useState(0)
    const [loading, setLoading] = useState(enabled)

    // Fetch notifications from API (Filtered by type=WORK_ORDER)
    const fetchNotifications = useCallback(async () => {
        // Skip if explicitly disabled
        if (!enabled) {
            setLoading(false)
            return
        }

        // Skip if permissions are loading or user doesn't have access
        if (isPermissionLoading) return
        if (!hasPermission('workorders:read')) {
            setLoading(false)
            return
        }

        try {
            // Note: We might need a specific endpoint count for filtered types if not available
            // but for now we fetch list and count from list or assume unread-count is global.
            // Ideally backend should support /api/notifications/unread-count?type=WORK_ORDER

            // Checking route.ts, filtering is supported in GET /api/notifications
            const listRes = await fetch(`/api/notifications?limit=${limit}&type=WORK_ORDER`)

            if (listRes.ok) {
                const data = await listRes.json()
                setNotifications(data.notifications || [])
                // Calculate unread count from the filtered list or if API provides total filtered unread
                // Since current API returns global unreadCount, we might rely on client side counting or need API update
                // For now, let's use the local count of unread items in the fetched list as a proxy
                // OR if the API response 'total' reflects filtered count?
                // route.ts: const { notifications, total } = await getNotificationsForUser(..., { type });
                // But unreadCount returned is global: const unreadCount = await getUnreadCount(session.user.id);

                // Workaround: Count unread in the fetched buffer
                const unreadInList = (data.notifications || []).filter((n: { isRead: boolean }) => !n.isRead).length
                setUnreadCount(unreadInList)
            }
        } catch (error) {
            console.error('[WorkOrders] Error fetching:', error)
        } finally {
            setLoading(false)
        }
    }, [limit, hasPermission, isPermissionLoading])

    // Initial fetch
    useEffect(() => {
        if (autoFetch && !isPermissionLoading && enabled) {
            fetchNotifications()
        }
    }, [autoFetch, fetchNotifications, isPermissionLoading, enabled])

    const playSound = () => {
        try {
            const audio = new Audio('/sounds/notification.mp3');
            audio.play().catch((_err) => console.log('Audio play failed:', _err));
        } catch (_error) {
            // Ignore audio errors
        }
    }

    // Handle new notification from WebSocket
    const handleNewNotification = useCallback(
        (payload: NotificationPayload) => {
             // Only process if it is a WORK_ORDER type
            if (payload.type !== 'WORK_ORDER') return;

            console.log('[WorkOrders] New notification received:', payload.title)
            playSound();

            // Add to beginning of list
            setNotifications((prev) => {
                const { link, ...restPayload } = payload
                const newNotification: WorkOrderNotification = {
                    ...restPayload,
                    ...(link ? { link } : {}),
                    isRead: false,
                }
                return [newNotification, ...prev.slice(0, limit - 1)]
            })

            // Increment unread count
            setUnreadCount((prev) => prev + 1)
        },
        [limit]
    )
    
    // Also listen for explicit Work Order events if they don't trigger NOTIFICATION_NEW
    // Checking types.ts: WORKORDER_ACTIVITY, WORKORDER_UPDATE, etc.
    // Usually these might also trigger a notification record creation on backend which emits NOTIFICATION_NEW
    // If we want redundancy to be safe:

    const handleWorkOrderActivity = useCallback((_payload: unknown) => {
        console.log('[WorkOrders] Activity received, refreshing...')
        playSound();
        fetchNotifications();
    }, [fetchNotifications])

    // Subscribe to WebSocket events
    useSocketEvent(SOCKET_EVENTS.NOTIFICATION_NEW, handleNewNotification)
    
    // Listen to specific WO events to ensure we catch everything
    useSocketEvent(SOCKET_EVENTS.WORKORDER_ACTIVITY, handleWorkOrderActivity)
    useSocketEvent(SOCKET_EVENTS.WORKORDER_UPDATE, handleWorkOrderActivity)
    useSocketEvent(SOCKET_EVENTS.WORKORDER_NEW, handleWorkOrderActivity)


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
            console.error('[WorkOrders] Error marking as read:', error)
        }
    }, [])

    // Mark all notifications as read
    const markAllAsRead = useCallback(async () => {
        try {
            const res = await fetch('/api/notifications', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ markAllRead: true, type: 'WORK_ORDER' }),
            })

            if (res.ok) {
                setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
                setUnreadCount(0)
            }
        } catch (error) {
            console.error('[WorkOrders] Error marking all as read:', error)
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
