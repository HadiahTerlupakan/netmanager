'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSocket, useSocketEvent } from '../SocketContext'
import { SOCKET_EVENTS, type WorkOrderActivityPayload } from '../types'


export interface ActivityItem {
    id: string
    type: 'comment' | 'update' | 'attachment'
    message?: string
    updateType?: string
    createdAt: string
    createdBy?: {
        id: string
        firstName?: string
        lastName?: string
        name?: string
    } | null
    attachment?: {
        id: string
        fileName: string
        filePath: string
        fileType: string
        caption?: string | null
    } | null
}

interface UseRealtimeWorkOrderActivityOptions {
    workOrderId: string
    initialActivities?: ActivityItem[]
}

interface UseRealtimeWorkOrderActivityResult {
    activities: ActivityItem[]
    isConnected: boolean
    addActivity: (activity: ActivityItem) => void
    setActivities: (activities: ActivityItem[]) => void
}

/**
 * Hook for real-time Work Order Activity Timeline with WebSocket
 * Listens for new comments, updates, and attachments and updates the timeline instantly
 */
export function useRealtimeWorkOrderActivity(
    options: UseRealtimeWorkOrderActivityOptions
): UseRealtimeWorkOrderActivityResult {
    const { workOrderId, initialActivities = [] } = options
    const { socket, isConnected } = useSocket()

    const [activities, setActivities] = useState<ActivityItem[]>(initialActivities)

    const prevInitialActivitiesRef = useRef(initialActivities)

    // Update activities when initial data changes
    useEffect(() => {
        if (initialActivities !== prevInitialActivitiesRef.current && initialActivities.length > 0) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setActivities(initialActivities)
            prevInitialActivitiesRef.current = initialActivities
        }
    }, [initialActivities])

    // Join work order-specific room when connected
    useEffect(() => {
        if (!socket || !isConnected || !workOrderId) return

        console.log(`[WorkOrderActivity] Joining room for workorder: ${workOrderId}`)
        socket.emit(SOCKET_EVENTS.JOIN_ROOM, { room: `workorder:${workOrderId}` })

        return () => {
            console.log(`[WorkOrderActivity] Leaving room for workorder: ${workOrderId}`)
            socket.emit(SOCKET_EVENTS.LEAVE_ROOM, { room: `workorder:${workOrderId}` })
        }
    }, [socket, isConnected, workOrderId])

    // Handle new activity from WebSocket
    const handleNewActivity = useCallback(
        (payload: WorkOrderActivityPayload) => {
            // Only process if it's for this work order
            if (payload.workOrderId !== workOrderId) return

            console.log('[WorkOrderActivity] New activity received:', payload.activity.type)

            // Add new activity to the list (avoid duplicates), insert at beginning (newest first)
            setActivities((prev) => {
                const exists = prev.some((a) => a.id === payload.activity.id)
                if (exists) return prev
                return [payload.activity, ...prev]
            })
        },
        [workOrderId]
    )

    // Subscribe to WebSocket events
    useSocketEvent(SOCKET_EVENTS.WORKORDER_ACTIVITY, handleNewActivity)

    // Manually add an activity (for optimistic updates after sending)
    const addActivity = useCallback((activity: ActivityItem) => {
        setActivities((prev) => {
            const exists = prev.some((a) => a.id === activity.id)
            if (exists) return prev
            return [activity, ...prev]
        })
    }, [])

    return {
        activities,
        isConnected,
        addActivity,
        setActivities,
    }
}
