'use client'

import {
    createContext,
    useContext,
    useEffect,
    useState,
    useCallback,
    useRef,
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

    // Initialize socket connection
    useEffect(() => {
        // Only connect if authenticated
        if (status !== 'authenticated' || !session?.user) {
            return
        }

        const user = session.user as {
            id?: string
            role?: string
            departmentId?: string
            accessAdminPanel?: boolean
        }

        if (!user.id) {
            console.warn('[WS] No user ID available for socket connection')
            return
        }

        console.log('[WS] Initializing connection for user:', user.id)

        const socketInstance = io({
            path: '/api/socket',
            withCredentials: true,
            auth: {
                userId: user.id,
                userRole: user.role || 'USER',
                departmentId: user.departmentId,
                accessAdminPanel: user.accessAdminPanel,
            },
            // Reconnection settings
            reconnection: true,
            reconnectionAttempts: 10,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            // Timeout settings
            timeout: 20000,
            // Transport settings (Force websocket to bypass multi-replica polling issues)
            transports: ['websocket'],
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

        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSocket(socketInstance)

        return () => {
            console.log('[WS] Cleaning up socket connection')
            socketInstance.disconnect()
            setSocket(null)
            setIsConnected(false)
        }
    }, [session, status])

    // Reconnect function
    const reconnect = useCallback(() => {
        // Force session update or just trigger a re-mount check
        // Ideally we shouldn't need manual reconnect with socket.io auto-reconnect
        // But if needed, we can just toggle a state or use the existing socket
        if (socket?.connected) {
            socket.disconnect()
            socket.connect()
        } else {
             // If socket is null (rare), we might need to depend on the effect
             // For now, let's just create a new one using the same logic if meaningful, 
             // but since we moved logic to useEffect, manual reconnect is harder without triggering effect.
             // We'll rely on socket.connect()
             socket?.connect()
        }
    }, [socket])



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
    const handlerRef = useRef(handler)

    // Update ref when handler changes
    useEffect(() => {
        handlerRef.current = handler
    }, [handler])

    useEffect(() => {
        if (!socket || !isConnected) return

        const listener = (data: T) => {
            handlerRef.current(data)
        }

        socket.on(event, listener)

        return () => {
            socket.off(event, listener)
        }
    }, [socket, isConnected, event])
}
