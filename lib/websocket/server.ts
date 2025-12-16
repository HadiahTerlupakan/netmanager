import type { Server as SocketIOServer, Socket } from 'socket.io'
import { SOCKET_EVENTS, type SocketData } from './types'

// Singleton instance
let io: SocketIOServer | null = null

/**
 * Initialize Socket.io server with authentication middleware
 */
export function initializeSocketServer(socketServer: SocketIOServer) {
    io = socketServer

    // Authentication middleware
    io.use(async (socket, next) => {
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
    io.on('connection', (socket: Socket) => {
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
        }

        // Handle dynamic room joining
        socket.on(SOCKET_EVENTS.JOIN_ROOM, (room: string) => {
            // Validate room name to prevent unauthorized access
            if (isRoomAllowed(socket, room)) {
                socket.join(room)
                console.log(`[WS] ${userId} joined room: ${room}`)
            }
        })

        // Handle room leaving
        socket.on(SOCKET_EVENTS.LEAVE_ROOM, (room: string) => {
            socket.leave(room)
            console.log(`[WS] ${userId} left room: ${room}`)
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
    return io
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

    return false
}

/**
 * Get the Socket.io server instance
 */
export function getSocketServer(): SocketIOServer | null {
    return io
}

/**
 * Check if WebSocket server is initialized
 */
export function isSocketServerReady(): boolean {
    return io !== null
}
