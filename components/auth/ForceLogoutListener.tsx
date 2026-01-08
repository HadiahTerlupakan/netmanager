'use client'

import { signOut } from 'next-auth/react'
import { useSocketEvent } from '@/lib/websocket/SocketContext'
import { toast } from 'react-hot-toast'

interface ForceLogoutPayload {
    message: string
    timestamp: string
}

/**
 * ForceLogoutListener - Global component that listens for force logout WebSocket events
 * 
 * When admin force-logs out a user, this component will:
 * 1. Show a toast notification
 * 2. Sign out the user via NextAuth
 * 3. Redirect to login page
 */
export default function ForceLogoutListener() {
    // Listen for force logout event - uses socket from SocketContext
    useSocketEvent<ForceLogoutPayload>('session:forceLogout', (payload) => {
        console.log('[ForceLogout] Received force logout event:', payload)
        
        // Show toast notification
        toast.error(payload.message || 'Sesi Anda telah diakhiri oleh administrator', {
            duration: 5000,
            icon: '🔒'
        })
        
        // Sign out and redirect to login
        setTimeout(() => {
            signOut({ callbackUrl: '/admin/login' })
        }, 1000) // Delay 1 second to let user see the toast
    })

    return null // This component doesn't render anything
}
