// WebSocket Event Types for Real-time Communication

// Event constants
export const SOCKET_EVENTS = {
    // Notifications
    NOTIFICATION_NEW: 'notification:new',
    NOTIFICATION_READ: 'notification:read',
    NOTIFICATION_COUNT: 'notification:count',

    // Support Tickets
    TICKET_NEW: 'ticket:new',
    TICKET_UPDATE: 'ticket:update',
    TICKET_REPLY: 'ticket:reply',
    TICKET_COUNT: 'ticket:count',

    // Work Orders
    WORKORDER_NEW: 'workorder:new',
    WORKORDER_UPDATE: 'workorder:update',
    WORKORDER_ASSIGNED: 'workorder:assigned',

    // Connection management
    JOIN_ROOM: 'join:room',
    LEAVE_ROOM: 'leave:room',
} as const

// Notification payload
export interface NotificationPayload {
    id: string
    type: string
    priority: string
    title: string
    message: string
    link?: string
    createdAt: string
}

// Support ticket payload
export interface TicketPayload {
    id: string
    ticketNumber: string
    subject: string
    status: string
    priority: string
    pelangganNama?: string
    createdAt?: string
}

// Work order payload
export interface WorkOrderPayload {
    id: string
    workOrderNumber: string
    title: string
    type: string
    status: string
    priority: string
    assignedToId?: string
}

// Count payload
export interface CountPayload {
    count: number
}

// Socket auth data
export interface SocketAuthData {
    userId: string
    userRole?: string
    departmentId?: string
}

// Socket data attached to socket instance
export interface SocketData {
    userId: string
    userRole: string
    departmentId?: string
}
