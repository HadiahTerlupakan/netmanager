import type { Socket, Server as SocketIOServer } from 'socket.io'
import { SOCKET_EVENTS, type SocketData } from './types'

// Declare global type for Socket.io server instance
declare global {
     
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
            const accessAdminPanel = auth?.accessAdminPanel as boolean | undefined

            if (!userId) {
                console.error('[WS] Auth failed: No userId provided')
                return next(new Error('Autentikasi diperlukan'))
            }

            // Attach user data to socket
            socket.data = {
                userId,
                userRole: userRole || 'USER',
                departmentId,
                accessAdminPanel,
            } as SocketData

            next()
        } catch (error) {
            console.error('[WS] Auth error:', error)
            next(new Error('Authentication failed'))
        }
    })

    // Connection handler
    globalThis.socketIOServer.on('connection', async (socket: Socket) => {
        const { userId, userRole, departmentId, accessAdminPanel } = socket.data as SocketData

        console.log(`[WS] User connected: ${userId} (${userRole}) [Admin: ${!!accessAdminPanel}]`)

        // Join user-specific room
        socket.join(`user:${userId}`)

        // CHECK ONLINE STATUS:
        // Get number of sockets in this user's room
        const sockets = await globalThis.socketIOServer?.in(`user:${userId}`).fetchSockets()
        const connectionCount = sockets?.length || 0

        // If this is the first/only connection, notify admins that user is ONLINE
        // Mobile App + Web Portal both connect here, so this covers both.
        if (connectionCount === 1) {
            globalThis.socketIOServer?.to('admin:notifications').emit(SOCKET_EVENTS.USER_STATUS_CHANGE, {
                userId,
                isOnline: true
            })
        }

        // Join department room if available
        if (departmentId) {
            socket.join(`department:${departmentId}`)
        }

        // Join role-based rooms
        // Join role-based rooms
        // STRICT RBAC: Only users with accessAdminPanel = true are considered Admins
        // This includes 'Super Admin', 'THD', etc. as long as the flag is set in their role.
        if (accessAdminPanel) {
            socket.join('admin:notifications')
            socket.join('admin:tickets')
            socket.join('admin:workorders')
            socket.join('admin:inventory')
        }

        // Handle request for online users (sent by Admin UI on load)
        socket.on('user:get_online_users', async () => {
             // Only admins (RBAC verified) need this list
             if (accessAdminPanel) {
                 // We can find all rooms starting with "user:"
                 const rooms = globalThis.socketIOServer?.sockets.adapter.rooms
                 const onlineUserIds: string[] = []
                 
                 if (rooms) {
                     for (const [roomName, _] of rooms) {
                         if (roomName.startsWith('user:')) {
                             const id = roomName.split(':')[1]
                             if (id) onlineUserIds.push(id)
                         }
                     }
                 }
                 
                 // Send back to the specific requesting admin socket
                 socket.emit('user:online_users_list', onlineUserIds)
             }
        })

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
        socket.on('disconnect', async (reason) => {
            console.log(`[WS] User disconnected: ${userId} (${reason})`)
            
            // Explicitly leave all rooms to prevent memory leaks
            const rooms = Array.from(socket.rooms)
            for (const room of rooms) {
                socket.leave(room)
            }
            
            // Check if any connections remain for this user
            const sockets = await globalThis.socketIOServer?.in(`user:${userId}`).fetchSockets()
            if (!sockets || sockets.length === 0) {
                // User is fully offline
                globalThis.socketIOServer?.to('admin:notifications').emit(SOCKET_EVENTS.USER_STATUS_CHANGE, {
                    userId,
                    isOnline: false
                })
            }
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

    // Admin can join admin rooms (includes SUPER_ADMIN, ADMIN, and users with admin panel access)
    const adminRoles = ['ADMIN', 'SUPER_ADMIN', 'OWNER', 'MANAGER']
    if (adminRoles.includes(userRole) && room.startsWith('admin:')) return true

    // Anyone can join their department room
    if (room.startsWith('department:')) return true

    // Allow joining ticket-specific rooms for chat (both admin and customers)
    // TODO: Add proper validation to ensure user has access to this ticket
    if (room.startsWith('ticket:')) return true

    // Allow joining work order rooms for Activity Timeline updates
    // TODO: Add proper validation to ensure user has access to this work order
    if (room.startsWith('workorder:')) return true

    // Allow joining chat conversation rooms
    // Format: chat:conversationId
    if (room.startsWith('chat:')) return true

    // Allow joining global chat room
    if (room === 'chat:global') return true

    return false
}

// Periodic cleanup of orphaned/empty rooms (every 5 minutes)
setInterval(() => {
    const io = globalThis.socketIOServer
    if (!io) return

    const rooms = io.sockets.adapter.rooms
    let cleanedCount = 0

    for (const [roomName, room] of rooms) {
        // Skip socket ID rooms (they start with socket ID pattern)
        if (io.sockets.sockets.has(roomName)) continue

        // Check if room is empty
        if (room.size === 0) {
            rooms.delete(roomName)
            cleanedCount++
        }
    }

    if (cleanedCount > 0) {
        console.log(`[WS] Cleaned up ${cleanedCount} empty rooms`)
    }
}, 300000) // Every 5 minutes

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
