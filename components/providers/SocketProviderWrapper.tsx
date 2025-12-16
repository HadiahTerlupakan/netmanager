'use client'

import { SocketProvider } from '@/lib/websocket/SocketContext'
import { type ReactNode } from 'react'

interface SocketProviderWrapperProps {
    children: ReactNode
}

/**
 * Client-side wrapper for SocketProvider
 * Use this in server components (layouts) to provide WebSocket context
 */
export default function SocketProviderWrapper({ children }: SocketProviderWrapperProps) {
    return <SocketProvider>{children}</SocketProvider>
}
