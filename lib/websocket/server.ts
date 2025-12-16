import type { Server as SocketIOServer, Socket } from 'socket.io'
import { SOCKET_EVENTS, type SocketData } from './types'

// Declare global type for Socket.io server instance
declare global {
    // eslint-disable-next-line no-var
    var socketIOServer: SocketIOServer | undefined
}

// Use globalThis to persist socket instance across hot reloads and API routes

/**
 * Initialize Socket.io server with authentication middleware
 */
export function initializeSocketServer(socketServer: SocketIOServer) {
    globalThis.socketIOServer = socketServer

    // Authentication middleware
    globalThis.socketIOServer.use(async (socket, next) => {
        try {
            const auth = socket.handshake.auth
            const userId = auth?.userId as string
            const userRole = auth?.userRole as string
            const departmentId = auth?.departmentId as string | undefined

            if (!userId) {
                console.error('[WS] Auth failed: No userId provided')
                return next(new Error('Authentication required'))
            }

            // Attach user data to socket
            socket.data = {
                userId,
                userRole: userRole || 'USER',
                departmentId,
            } as SocketData

            next()
        } catch (error) {
            console.error('[WS] Auth error:', error)
            next(new Error('Authentication failed'))
        }
    })

    // Connection handler
    globalThis.socketIOServer.on('connection', (socket: Socket) => {
        const { userId, userRole, departmentId } = socket.data as SocketData

        console.log(`[WS] User connected: ${userId} (${userRole})`)

        // Join user-specific room
        socket.join(`user:${userId}`)

        // Join department room if available
        if (departmentId) {
            socket.join(`department:${departmentId}`)
        }

        // Join role-based rooms
        if (userRole === 'ADMIN') {
            socket.join('admin:notifications')
            socket.join('admin:tickets')
            socket.join('admin:workorders')
            socket.join('admin:inventory')
        }

        // Handle dynamic room joining
        socket.on(SOCKET_EVENTS.JOIN_ROOM, (data: { room: string } | string) => {
            const room = typeof data === 'string' ? data : data.room
            // Validate room name to prevent unauthorized access
            if (room && isRoomAllowed(socket, room)) {
                socket.join(room)
                console.log(`[WS] ${userId} joined room: ${room}`)
            } else {
                console.warn(`[WS] ${userId} not allowed to join room: ${room}`)
            }
        })

        // Handle room leaving
        socket.on(SOCKET_EVENTS.LEAVE_ROOM, (data: { room: string } | string) => {
            const room = typeof data === 'string' ? data : data.room
            if (room) {
                socket.leave(room)
                console.log(`[WS] ${userId} left room: ${room}`)
            }
        })

        // Handle disconnect
        socket.on('disconnect', (reason) => {
            console.log(`[WS] User disconnected: ${userId} (${reason})`)
        })

        // Handle errors
        socket.on('error', (error) => {
            console.error(`[WS] Socket error for ${userId}:`, error)
        })
    })

    console.log('[WS] Socket.io server initialized')
    return globalThis.socketIOServer
}

/**
 * Check if socket is allowed to join a room
 */
function isRoomAllowed(socket: Socket, room: string): boolean {
    const { userId, userRole } = socket.data as SocketData

    // User can join their own room
    if (room === `user:${userId}`) return true

    // Admin can join admin rooms
    if (userRole === 'ADMIN' && room.startsWith('admin:')) return true

    // Anyone can join their department room
    if (room.startsWith('department:')) return true

    // Allow joining ticket-specific rooms for chat (both admin and customers)
    // TODO: Add proper validation to ensure user has access to this ticket
    if (room.startsWith('ticket:')) return true

    // Allow joining work order rooms for Activity Timeline updates
    // TODO: Add proper validation to ensure user has access to this work order
    if (room.startsWith('workorder:')) return true

    return false
}

/**
 * Get the Socket.io server instance
 */
export function getSocketServer(): SocketIOServer | null {
    return globalThis.socketIOServer || null
}

/**
 * Check if WebSocket server is initialized
 */
export function isSocketServerReady(): boolean {
    return globalThis.socketIOServer !== undefined
}
