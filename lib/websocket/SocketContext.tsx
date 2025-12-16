'use client'

import {
    createContext,
    useContext,
    useEffect,
    useState,
    useCallback,
    type ReactNode,
} from 'react'
import { io, type Socket } from 'socket.io-client'
import { useSession } from 'next-auth/react'

interface SocketContextType {
    socket: Socket | null
    isConnected: boolean
    lastError: string | null
    reconnect: () => void
}

const SocketContext = createContext<SocketContextType>({
    socket: null,
    isConnected: false,
    lastError: null,
    reconnect: () => { },
})

interface SocketProviderProps {
    children: ReactNode
}

export function SocketProvider({ children }: SocketProviderProps) {
    const { data: session, status } = useSession()
    const [socket, setSocket] = useState<Socket | null>(null)
    const [isConnected, setIsConnected] = useState(false)
    const [lastError, setLastError] = useState<string | null>(null)

    const connect = useCallback(() => {
        // Only connect if authenticated
        if (status !== 'authenticated' || !session?.user) {
            return null
        }

        const user = session.user as {
            id?: string
            role?: string
            departmentId?: string
        }

        if (!user.id) {
            console.warn('[WS] No user ID available for socket connection')
            return null
        }

        const socketInstance = io({
            path: '/api/socket',
            auth: {
                userId: user.id,
                userRole: user.role || 'USER',
                departmentId: user.departmentId,
            },
            // Reconnection settings
            reconnection: true,
            reconnectionAttempts: 10,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            // Timeout settings
            timeout: 20000,
            // Transport settings
            transports: ['websocket', 'polling'],
            // Only connect when browser is focused (optional optimization)
            autoConnect: true,
        })

        socketInstance.on('connect', () => {
            console.log('[WS] Connected:', socketInstance.id)
            setIsConnected(true)
            setLastError(null)
        })

        socketInstance.on('disconnect', (reason) => {
            console.log('[WS] Disconnected:', reason)
            setIsConnected(false)
        })

        socketInstance.on('connect_error', (error) => {
            console.error('[WS] Connection error:', error.message)
            setLastError(error.message)
            setIsConnected(false)
        })

        socketInstance.on('reconnect', (attemptNumber) => {
            console.log('[WS] Reconnected after', attemptNumber, 'attempts')
            setIsConnected(true)
            setLastError(null)
        })

        socketInstance.on('reconnect_error', (error) => {
            console.warn('[WS] Reconnection error:', error.message)
        })

        socketInstance.on('reconnect_failed', () => {
            console.error('[WS] Reconnection failed after all attempts')
            setLastError('Koneksi terputus. Silakan refresh halaman.')
        })

        return socketInstance
    }, [session, status])

    // Initialize socket connection
    useEffect(() => {
        const socketInstance = connect()

        if (socketInstance) {
            setSocket(socketInstance)
        }

        return () => {
            if (socketInstance) {
                socketInstance.disconnect()
            }
        }
    }, [connect])

    // Reconnect function
    const reconnect = useCallback(() => {
        if (socket) {
            socket.disconnect()
        }
        const newSocket = connect()
        if (newSocket) {
            setSocket(newSocket)
        }
    }, [socket, connect])

    // Handle visibility change (reconnect when tab becomes visible)
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible' && socket && !socket.connected) {
                console.log('[WS] Tab visible, attempting reconnect...')
                socket.connect()
            }
        }

        document.addEventListener('visibilitychange', handleVisibilityChange)
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange)
        }
    }, [socket])

    return (
        <SocketContext.Provider value={{ socket, isConnected, lastError, reconnect }}>
            {children}
        </SocketContext.Provider>
    )
}

/**
 * Hook to access socket context
 */
export function useSocket() {
    const context = useContext(SocketContext)
    if (!context) {
        throw new Error('useSocket must be used within a SocketProvider')
    }
    return context
}

/**
 * Hook to subscribe to a socket event
 */
export function useSocketEvent<T>(event: string, handler: (data: T) => void) {
    const { socket, isConnected } = useSocket()

    useEffect(() => {
        if (!socket || !isConnected) return

        socket.on(event, handler)

        return () => {
            socket.off(event, handler)
        }
    }, [socket, isConnected, event, handler])
}
