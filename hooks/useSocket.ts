import { useEffect } from 'react'
import { io, Socket } from 'socket.io-client'

let socket: Socket | null = null

export const getSocket = () => {
    if (!socket) {
        socket = io({
            path: '/api/socket',
            transports: ['websocket'],
            upgrade: true,
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
        })
    }
    return socket
}

export function useSocketEvent(event: string, handler: (data: any) => void) {
    useEffect(() => {
        const socketInstance = getSocket()

        socketInstance.on(event, handler)

        return () => {
            socketInstance.off(event, handler)
        }
    }, [event, handler])
}

export function useSocket() {
    useEffect(() => {
        getSocket()
    }, [])

    return { socket: getSocket() }
}
