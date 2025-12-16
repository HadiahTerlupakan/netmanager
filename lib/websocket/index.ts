// WebSocket module exports
export { SocketProvider, useSocket, useSocketEvent } from './SocketContext'
export { SOCKET_EVENTS } from './types'
export type {
    NotificationPayload,
    TicketPayload,
    WorkOrderPayload,
    CountPayload,
    SocketAuthData,
    SocketData,
} from './types'

// Hooks
export { useRealtimeNotifications } from './hooks/useRealtimeNotifications'
export type { Notification } from './hooks/useRealtimeNotifications'
export { useRealtimeSupportTickets } from './hooks/useRealtimeSupportTickets'
export type { TicketPreview } from './hooks/useRealtimeSupportTickets'

// Server-side exports (only import in server components/API routes)
// import { socketEmitter } from '@/lib/websocket/emitter'
// import { initializeSocketServer, getSocketServer } from '@/lib/websocket/server'
