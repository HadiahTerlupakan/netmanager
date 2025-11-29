'use client'

import { useEffect, useState } from 'react'
import { HiOutlineWifi, HiOutlineHome } from 'react-icons/hi2'
import Link from 'next/link'

export default function OfflinePage() {
    const [isOnline, setIsOnline] = useState(true)

    useEffect(() => {
        setIsOnline(navigator.onLine)

        const handleOnline = () => setIsOnline(true)
        const handleOffline = () => setIsOnline(false)

        window.addEventListener('online', handleOnline)
        window.addEventListener('offline', handleOffline)

        return () => {
            window.removeEventListener('online', handleOnline)
            window.removeEventListener('offline', handleOffline)
        }
    }, [])

    if (isOnline) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-400 to-blue-500 p-4">
                <div className="text-center">
                    <div className="inline-block p-6 bg-white/20 backdrop-blur rounded-3xl mb-6">
                        <HiOutlineWifi className="w-20 h-20 text-white" />
                    </div>
                    <h1 className="text-3xl font-bold text-white mb-4">You're Back Online!</h1>
                    <p className="text-white/80 mb-6">
                        Your connection has been restored.
                    </p>
                    <Link
                        href="/employee"
                        className="inline-flex items-center gap-2 px-6 py-3 bg-white text-blue-600 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all"
                    >
                        <HiOutlineHome className="w-5 h-5" />
                        Go to Dashboard
                    </Link>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-700 to-gray-900 p-4">
            <div className="text-center">
                <div className="inline-block p-6 bg-white/10 backdrop-blur rounded-3xl mb-6">
                    <div className="relative">
                        <HiOutlineWifi className="w-20 h-20 text-white/50" />
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-24 h-1 bg-red-500 rotate-45"></div>
                        </div>
                    </div>
                </div>
                <h1 className="text-3xl font-bold text-white mb-4">You're Offline</h1>
                <p className="text-white/70 mb-6 max-w-md mx-auto">
                    It looks like you've lost your internet connection. Some features may not be available until you're back online.
                </p>
                <div className="space-y-4">
                    <p className="text-white/50 text-sm">
                        Tip: You can still view previously cached pages
                    </p>
                    <button
                        onClick={() => window.location.reload()}
                        className="inline-flex items-center gap-2 px-6 py-3 bg-white/20 text-white border border-white/30 rounded-xl font-semibold backdrop-blur hover:bg-white/30 transition-all"
                    >
                        Retry Connection
                    </button>
                </div>
            </div>
        </div>
    )
}
