import { getSocketServer } from './server'
import {
    SOCKET_EVENTS,
    type NotificationPayload,
    type TicketPayload,
    type WorkOrderPayload,
    type CountPayload,
} from './types'

const INTERNAL_WS_SECRET = process.env.INTERNAL_WS_SECRET || 'netmanager-ws-internal-2024'
const WS_SERVER_URL = process.env.WS_SERVER_URL || 'http://localhost:3000'

/**
 * Fallback: Emit via internal HTTP endpoint when Socket.io server is not available
 * in the current process (e.g., API routes in development mode)
 */
async function emitViaHttp(event: string, room: string, payload: unknown): Promise<boolean> {
    try {
        const response = await fetch(`${WS_SERVER_URL}/_internal/emit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ event, room, payload, secret: INTERNAL_WS_SECRET }),
        })
        if (response.ok) {
            console.log(`[WS HTTP] Emitted ${event} to ${room}`)
            return true
        } else {
            console.error(`[WS HTTP] Failed to emit ${event}:`, await response.text())
            return false
        }
    } catch (error) {
        console.error(`[WS HTTP] Error emitting ${event}:`, error)
        return false
    }
}

/**
 * Socket emitter helper for server-side code
 * Use this to emit WebSocket events from API routes and services
 */
export const socketEmitter = {
    /**
     * Emit notification to a specific user
     */
    notifyUser(userId: string, notification: NotificationPayload) {
        const io = getSocketServer()
        if (io) {
            io.to(`user:${userId}`).emit(SOCKET_EVENTS.NOTIFICATION_NEW, notification)
            console.log(`[WS] Emitted notification to user:${userId}`)
        }
    },

    /**
     * Emit notification to all users in a department
     */
    notifyDepartment(departmentId: string, notification: NotificationPayload) {
        const io = getSocketServer()
        if (io) {
            io.to(`department:${departmentId}`).emit(SOCKET_EVENTS.NOTIFICATION_NEW, notification)
            console.log(`[WS] Emitted notification to department:${departmentId}`)
        }
    },

    /**
     * Emit notification to all admins
     */
    notifyAdmins(notification: NotificationPayload) {
        const io = getSocketServer()
        if (io) {
            io.to('admin:notifications').emit(SOCKET_EVENTS.NOTIFICATION_NEW, notification)
            console.log(`[WS] Emitted notification to all admins`)
        }
    },

    /**
     * Update notification count for a user
     */
    updateNotificationCount(userId: string, count: number) {
        const io = getSocketServer()
        if (io) {
            const payload: CountPayload = { count }
            io.to(`user:${userId}`).emit(SOCKET_EVENTS.NOTIFICATION_COUNT, payload)
        }
    },

    /**
     * Emit new support ticket to all admins
     */
    newTicket(ticket: TicketPayload) {
        const io = getSocketServer()
        if (io) {
            io.to('admin:tickets').emit(SOCKET_EVENTS.TICKET_NEW, ticket)
            console.log(`[WS] Emitted new ticket: ${ticket.ticketNumber}`)
        }
    },

    /**
     * Emit ticket update to all admins
     */
    updateTicket(ticket: TicketPayload) {
        const io = getSocketServer()
        if (io) {
            io.to('admin:tickets').emit(SOCKET_EVENTS.TICKET_UPDATE, ticket)
        }
    },

    /**
     * Emit ticket reply notification
     */
    ticketReply(ticket: TicketPayload, targetUserId?: string) {
        const io = getSocketServer()
        if (io) {
            // Notify admins
            io.to('admin:tickets').emit(SOCKET_EVENTS.TICKET_REPLY, ticket)

            // If target user specified (e.g., customer), notify them too
            if (targetUserId) {
                io.to(`user:${targetUserId}`).emit(SOCKET_EVENTS.TICKET_REPLY, ticket)
            }
        }
    },

    /**
     * Emit real-time chat message to ticket room
     * This is for instant message display in chat UI
     */
    ticketMessage(ticketId: string, reply: {
        id: string
        message: string
        isFromAdmin: boolean
        createdAt: string
        sender?: { id: string; name: string; image?: string } | null
        attachments?: string[] | null
    }) {
        const io = getSocketServer()
        const payload = { ticketId, reply }
        const room = `ticket:${ticketId}`

        if (io) {
            // Direct emit when Socket.io server is available in this process
            io.to(room).emit(SOCKET_EVENTS.TICKET_MESSAGE, payload)
            console.log(`[WS] Emitted chat message to ${room}`)

            // Debug: Check how many sockets are in the room
            const roomData = io.sockets.adapter.rooms.get(room)
            console.log(`[WS DEBUG] Sockets in room ${room}:`, roomData?.size || 0)
        } else {
            // Fallback: Use internal HTTP endpoint for cross-process emit
            console.log(`[WS] Socket server not in this process, using HTTP fallback for ${room}`)
            emitViaHttp(SOCKET_EVENTS.TICKET_MESSAGE, room, payload)
        }
    },

    /**
     * Update ticket count for admins
     */
    updateTicketCount(count: number) {
        const io = getSocketServer()
        if (io) {
            const payload: CountPayload = { count }
            io.to('admin:tickets').emit(SOCKET_EVENTS.TICKET_COUNT, payload)
        }
    },

    /**
     * Emit new work order notification
     */
    newWorkOrder(workOrder: WorkOrderPayload, departmentId?: string) {
        const io = getSocketServer()
        if (io) {
            io.to('admin:workorders').emit(SOCKET_EVENTS.WORKORDER_NEW, workOrder)

            if (departmentId) {
                io.to(`department:${departmentId}`).emit(SOCKET_EVENTS.WORKORDER_NEW, workOrder)
            }
        }
    },

    /**
     * Emit work order update
     */
    updateWorkOrder(workOrder: WorkOrderPayload) {
        const io = getSocketServer()
        if (io) {
            io.to('admin:workorders').emit(SOCKET_EVENTS.WORKORDER_UPDATE, workOrder)

            // Notify assigned user if exists
            if (workOrder.assignedToId) {
                io.to(`user:${workOrder.assignedToId}`).emit(SOCKET_EVENTS.WORKORDER_UPDATE, workOrder)
            }
        }
    },

    /**
     * Emit work order assignment notification
     */
    workOrderAssigned(workOrder: WorkOrderPayload, assignedToId: string) {
        const io = getSocketServer()
        if (io) {
            io.to(`user:${assignedToId}`).emit(SOCKET_EVENTS.WORKORDER_ASSIGNED, workOrder)
        }
    },

    /**
     * Emit real-time activity update for Work Order Activity Timeline
     * This includes comments, status updates, and attachments
     */
    workOrderActivity(workOrderId: string, activity: {
        id: string
        type: 'comment' | 'update' | 'attachment'
        message?: string
        updateType?: string
        createdAt: string
        createdBy?: { id: string; firstName?: string; lastName?: string; name?: string } | null
        attachment?: { id: string; fileName: string; filePath: string; fileType: string; caption?: string | null } | null
    }) {
        const io = getSocketServer()
        const payload = { workOrderId, activity }
        const room = `workorder:${workOrderId}`

        if (io) {
            // Direct emit when Socket.io server is available in this process
            io.to(room).emit(SOCKET_EVENTS.WORKORDER_ACTIVITY, payload)
            console.log(`[WS] Emitted activity to ${room}`)

            // Debug: Check how many sockets are in the room
            const roomData = io.sockets.adapter.rooms.get(room)
            console.log(`[WS DEBUG] Sockets in room ${room}:`, roomData?.size || 0)
        } else {
            // Fallback: Use internal HTTP endpoint for cross-process emit
            console.log(`[WS] Socket server not in this process, using HTTP fallback for ${room}`)
            emitViaHttp(SOCKET_EVENTS.WORKORDER_ACTIVITY, room, payload)
        }
    },

    /**
     * Emit inventory update event (broadcast to all admins)
     */
    inventoryUpdate(data: { type: 'masuk' | 'keluar', barangId: string, gudangId: string, jumlah: number, totalStok: number }) {
        const io = getSocketServer()
        if (io) {
            // Broadcast to admin:inventory room
            io.to('admin:inventory').emit(SOCKET_EVENTS.INVENTORY_UPDATE, data)
            console.log(`[WS] Emitted inventory update to admin:inventory: ${data.type} ${data.jumlah} items`)
        }
    },

    /**
     * Broadcast to all connected clients (use sparingly)
     */
    broadcast(event: string, data: unknown) {
        const io = getSocketServer()
        if (io) {
            io.emit(event, data)
        }
    },
}
