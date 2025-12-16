'use client'

import { SessionProvider } from 'next-auth/react'
import { KaryawanAuthProvider } from './KaryawanAuthProvider'
import KaryawanBottomNav from './KaryawanBottomNav'
import { SocketProvider } from '@/lib/websocket/SocketContext'

export function KaryawanProviders({ children }: { children: React.ReactNode }) {
    return (
        <SessionProvider refetchOnWindowFocus={true} refetchInterval={0}>
            <SocketProvider>
                <KaryawanAuthProvider>
                    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
                        {/* Status bar gradient overlay for iOS */}
                        <div className="fixed top-0 left-0 right-0 h-12 bg-gradient-to-b from-white/80 to-transparent dark:from-slate-900/80 pointer-events-none z-40" />

                        <main className="relative pb-24 min-h-screen">
                            {children}
                        </main>

                        <KaryawanBottomNav />
                    </div>
                </KaryawanAuthProvider>
            </SocketProvider>
        </SessionProvider>
    )
}

