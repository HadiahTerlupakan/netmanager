import { getSocketServer } from './server'
import {
    SOCKET_EVENTS,
    type NotificationPayload,
    type TicketPayload,
    type WorkOrderPayload,
    type CountPayload,
} from './types'

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
     * Broadcast to all connected clients (use sparingly)
     */
    broadcast(event: string, data: unknown) {
        const io = getSocketServer()
        if (io) {
            io.emit(event, data)
        }
    },
}
