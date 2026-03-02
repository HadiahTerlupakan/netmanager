'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSocket, useSocketEvent } from '../SocketContext'
import { SOCKET_EVENTS } from '../types'
import { useSession } from 'next-auth/react'

export interface PendingPayment {
    id: string
    amount: number
    method: string
    status: string
    receiptUrl: string
    createdAt: string
    customerName: string
    invoice: {
        id: string
        invoiceNumber: string
        customerId: string
        totalAmount: number
    } | null
}

interface UseRealtimePaymentApprovalsReturn {
    payments: PendingPayment[]
    loading: boolean
    isConnected: boolean
    refresh: () => Promise<void>
}

export function useRealtimePaymentApprovals(): UseRealtimePaymentApprovalsReturn {
    const { data: session } = useSession()
    const { isConnected } = useSocket()
    const [payments, setPayments] = useState<PendingPayment[]>([])
    const [loading, setLoading] = useState(true)

    const fetchPendingPayments = useCallback(async () => {
        try {
            setLoading(true)
            const res = await fetch('/api/admin/payments/pending-manual')
            const json = await res.json()
            if (json.success) {
                setPayments(json.data)
            }
        } catch (error) {
            console.error('Failed to fetch pending payments:', error)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        // Initial fetch
        fetchPendingPayments()
    }, [fetchPendingPayments])

    const handlePaymentNew = useCallback((payload: unknown) => {
        console.log('[WS] New payment pending:', payload)
        // Refetch to get consistent latest data
        fetchPendingPayments()

        // Play notification sound
        try {
            const audio = new Audio('/sounds/notification.mp3')
            audio.play().catch(e => console.error('Audio play failed:', e))
        } catch (e) {
            console.error('Audio initialization failed:', e)
        }
    }, [fetchPendingPayments])

    // Only subscribe if user is admin
    const isAdmin = ['ADMIN', 'SUPER_ADMIN', 'OWNER', 'MANAGER'].includes(session?.user?.role || '')
        || (session?.user as { accessAdminPanel?: boolean })?.accessAdminPanel;

    useSocketEvent(SOCKET_EVENTS.PAYMENT_PENDING_NEW, (payload: unknown) => {
        if (isAdmin) {
            handlePaymentNew(payload)
        }
    });

    return {
        payments,
        loading,
        isConnected, // Return connection status from context
        refresh: fetchPendingPayments
    }
}
