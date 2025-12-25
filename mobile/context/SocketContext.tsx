import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { AppState, AppStateStatus } from 'react-native';
import { useAuth } from './AuthContext';
import { Config } from '../constants/Config';

interface SocketContextType {
    socket: Socket | null;
    isConnected: boolean;
    lastError: string | null;
    reconnect: () => void;
}

const SocketContext = createContext<SocketContextType>({
    socket: null,
    isConnected: false,
    lastError: null,
    reconnect: () => { },
});

interface SocketProviderProps {
    children: ReactNode;
}

export function SocketProvider({ children }: SocketProviderProps) {
    const { token, user } = useAuth();
    const [socket, setSocket] = useState<Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [lastError, setLastError] = useState<string | null>(null);

    const connect = useCallback(() => {
        // Only connect if authenticated
        if (!token || !user?.id) {
            console.log('[WS Mobile] No token or user, skipping connection');
            return null;
        }

        // Parse base URL - remove trailing slash and /api if present
        let baseUrl = Config.API_URL;
        if (baseUrl.endsWith('/')) {
            baseUrl = baseUrl.slice(0, -1);
        }

        console.log('[WS Mobile] Connecting to:', baseUrl);

        const socketInstance = io(baseUrl, {
            path: '/api/socket',
            auth: {
                userId: user.id,
                userRole: user.role || 'USER',
            },
            // Reconnection settings
            reconnection: true,
            reconnectionAttempts: 10,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            // Timeout settings
            timeout: 20000,
            // Transport settings - websocket first, then polling
            transports: ['websocket', 'polling'],
            autoConnect: true,
            // Extra headers for auth
            extraHeaders: {
                Authorization: `Bearer ${token}`,
            },
        });

        socketInstance.on('connect', () => {
            console.log('[WS Mobile] Connected:', socketInstance.id);
            setIsConnected(true);
            setLastError(null);

            // Join user's personal room for notifications
            socketInstance.emit('join:room', { room: `user:${user.id}` });
        });

        socketInstance.on('disconnect', (reason) => {
            console.log('[WS Mobile] Disconnected:', reason);
            setIsConnected(false);
        });

        socketInstance.on('connect_error', (error) => {
            console.error('[WS Mobile] Connection error:', error.message);
            setLastError(error.message);
            setIsConnected(false);
        });

        socketInstance.on('reconnect', (attemptNumber) => {
            console.log('[WS Mobile] Reconnected after', attemptNumber, 'attempts');
            setIsConnected(true);
            setLastError(null);

            // Re-join rooms after reconnect
            socketInstance.emit('join:room', { room: `user:${user.id}` });
        });

        socketInstance.on('reconnect_error', (error) => {
            console.warn('[WS Mobile] Reconnection error:', error.message);
        });

        socketInstance.on('reconnect_failed', () => {
            console.error('[WS Mobile] Reconnection failed after all attempts');
            setLastError('Koneksi terputus');
        });

        return socketInstance;
    }, [token, user]);

    // Initialize socket connection
    useEffect(() => {
        const socketInstance = connect();

        if (socketInstance) {
            setSocket(socketInstance);
        }

        return () => {
            if (socketInstance) {
                socketInstance.disconnect();
            }
        };
    }, [connect]);

    // Reconnect function
    const reconnect = useCallback(() => {
        if (socket) {
            socket.disconnect();
        }
        const newSocket = connect();
        if (newSocket) {
            setSocket(newSocket);
        }
    }, [socket, connect]);

    // Handle app state changes (reconnect when app becomes active)
    useEffect(() => {
        const handleAppStateChange = (nextAppState: AppStateStatus) => {
            if (nextAppState === 'active' && socket && !socket.connected) {
                console.log('[WS Mobile] App active, attempting reconnect...');
                socket.connect();
            }
        };

        const subscription = AppState.addEventListener('change', handleAppStateChange);
        return () => {
            subscription.remove();
        };
    }, [socket]);

    return (
        <SocketContext.Provider value={{ socket, isConnected, lastError, reconnect }}>
            {children}
        </SocketContext.Provider>
    );
}

/**
 * Hook to access socket context
 */
export function useSocket() {
    const context = useContext(SocketContext);
    if (!context) {
        throw new Error('useSocket must be used within a SocketProvider');
    }
    return context;
}

/**
 * Hook to subscribe to a socket event
 */
export function useSocketEvent<T>(event: string, handler: (data: T) => void) {
    const { socket, isConnected } = useSocket();

    useEffect(() => {
        if (!socket || !isConnected) return;

        socket.on(event, handler);

        return () => {
            socket.off(event, handler);
        };
    }, [socket, isConnected, event, handler]);
}

/**
 * Hook to join a room
 */
export function useSocketRoom(room: string) {
    const { socket, isConnected } = useSocket();

    useEffect(() => {
        if (!socket || !isConnected || !room) return;

        console.log(`[WS Mobile] Joining room: ${room}`);
        socket.emit('join:room', { room });

        return () => {
            console.log(`[WS Mobile] Leaving room: ${room}`);
            socket.emit('leave:room', { room });
        };
    }, [socket, isConnected, room]);
}
