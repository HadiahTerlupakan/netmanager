'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSocket, useSocketEvent } from '../SocketContext'
import { SOCKET_EVENTS, type TicketPayload, type CountPayload } from '../types'
import { usePermission } from '@/hooks/use-permission'

export interface TicketPreview {
    id: string
    ticketNumber: string
    subject: string
    status: string
    priority: string
    category?: string
    createdAt: string
    pelanggan: {
        nama: string
        idPelanggan: string
    }
    lastReply?: {
        isFromAdmin: boolean
        createdAt: string
    } | null
}

interface UseRealtimeSupportTicketsOptions {
    limit?: number
    autoFetch?: boolean
    enabled?: boolean
}

interface UseRealtimeSupportTicketsResult {
    tickets: TicketPreview[]
    unreadCount: number
    loading: boolean
    isConnected: boolean
    refresh: () => Promise<void>
}

/**
 * Hook for real-time support tickets with WebSocket
 */
export function useRealtimeSupportTickets(
    options: UseRealtimeSupportTicketsOptions = {}
): UseRealtimeSupportTicketsResult {
    const { limit = 5, autoFetch = true, enabled = true } = options
    const { isConnected } = useSocket()
    const { hasPermission, isLoading: isPermissionLoading } = usePermission()

    const [tickets, setTickets] = useState<TicketPreview[]>([])
    const [unreadCount, setUnreadCount] = useState(0)
    const [loading, setLoading] = useState(enabled) // Only loading if enabled
    const lastCountRef = useRef(0)

    // Fetch tickets from API
    const fetchTickets = useCallback(async () => {
        // Skip if explicitly disabled
        if (!enabled) {
            setLoading(false)
            return
        }

        // Skip if permissions are loading or user doesn't have access
        if (isPermissionLoading) return
        if (!hasPermission('support:read')) {
            setLoading(false)
            return
        }

        try {
            const [countRes, listRes] = await Promise.all([
                fetch('/api/admin/support-tickets/unread-count'),
                fetch(`/api/admin/support-tickets?limit=${limit}`),
            ])

            if (countRes.ok) {
                const data = await countRes.json()
                const newCount = data.count || 0

                // Check if count increased (new ticket)
                if (newCount > lastCountRef.current && lastCountRef.current > 0) {
                    console.log('[Tickets] New ticket detected!')
                }

                lastCountRef.current = newCount
                setUnreadCount(newCount)
            }

            if (listRes.ok) {
                const data = await listRes.json()
                setTickets(data.tickets || [])
            }
        } catch (error) {
            console.error('[Tickets] Error fetching:', error)
        } finally {
            setLoading(false)
        }
    }, [limit])

    // Initial fetch
    useEffect(() => {
        if (autoFetch && !isPermissionLoading && enabled) {
            fetchTickets()
        }
    }, [autoFetch, fetchTickets, isPermissionLoading, enabled])

    // Handle new ticket from WebSocket
    const handleNewTicket = useCallback(
        (payload: TicketPayload) => {
            console.log('[Tickets] New ticket received:', payload.ticketNumber)
            
            // Play notification sound
            try {
                const audio = new Audio('/sounds/notification.mp3');
                audio.play().catch((_err) => console.log('Audio play failed:', _err));
            } catch (_error) {
                // Ignore audio errors
            }
            
            // Refetch to get complete ticket data with relations
            fetchTickets()
        },
        [fetchTickets]
    )

    // Handle ticket update from WebSocket
    const handleTicketUpdate = useCallback(
        (payload: TicketPayload) => {
            console.log('[Tickets] Ticket updated:', payload.ticketNumber)
            // Update the specific ticket in the list
            setTickets((prev) =>
                prev.map((t) =>
                    t.id === payload.id
                        ? { ...t, status: payload.status, priority: payload.priority }
                        : t
                )
            )
        },
        []
    )

    // Handle ticket reply from WebSocket
    const handleTicketReply = useCallback(
        (payload: TicketPayload) => {
            console.log('[Tickets] Ticket reply:', payload.ticketNumber)

            // Play notification sound
            try {
                const audio = new Audio('/sounds/notification.mp3');
                audio.play().catch((_err) => console.log('Audio play failed:', _err));
            } catch (_error) {
                // Ignore audio errors
            }

            // Refetch to get updated lastReply
            fetchTickets()
        },
        [fetchTickets]
    )

    // Handle count update from WebSocket
    const handleCountUpdate = useCallback((payload: CountPayload) => {
        setUnreadCount(payload.count)
        lastCountRef.current = payload.count
    }, [])

    // Subscribe to WebSocket events
    useSocketEvent(SOCKET_EVENTS.TICKET_NEW, handleNewTicket)
    useSocketEvent(SOCKET_EVENTS.TICKET_UPDATE, handleTicketUpdate)
    useSocketEvent(SOCKET_EVENTS.TICKET_REPLY, handleTicketReply)
    useSocketEvent(SOCKET_EVENTS.TICKET_COUNT, handleCountUpdate)

    return {
        tickets,
        unreadCount,
        loading,
        isConnected,
        refresh: fetchTickets,
    }
}
