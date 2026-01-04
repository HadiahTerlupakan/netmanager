'use client'

import { useState, useEffect, useCallback } from 'react'
import { HiBell, HiBellSlash, HiXMark } from 'react-icons/hi2'

interface PushNotificationManagerProps {
    className?: string
}

export function PushNotificationManager({ className }: PushNotificationManagerProps) {
    const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default')
    const [isSubscribed, setIsSubscribed] = useState(false)
    const [loading, setLoading] = useState(false)
    const [showBanner, setShowBanner] = useState(false)
    const [vapidKey, setVapidKey] = useState<string | null>(null)

    useEffect(() => {
        checkSupport()
    }, [])

    const checkSupport = async () => {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            setPermission('unsupported')
            return
        }

        // Get VAPID public key
        try {
            const response = await fetch('/api/notifications/subscribe')
            if (response.ok) {
                const data = await response.json()
                setVapidKey(data.publicKey)
            } else {
                console.warn('Push notifications not configured on server')
                setPermission('unsupported')
                return
            }
        } catch (error) {
            console.error('Error fetching VAPID key:', error)
            setPermission('unsupported')
            return
        }

        const currentPermission = Notification.permission
        setPermission(currentPermission)

        if (currentPermission === 'granted') {
            // Check if already subscribed
            const registration = await navigator.serviceWorker.ready
            const subscription = await registration.pushManager.getSubscription()
            setIsSubscribed(!!subscription)
        } else if (currentPermission === 'default') {
            // Show banner to ask for permission
            const dismissed = localStorage.getItem('push-notification-dismissed')
            if (!dismissed) {
                setShowBanner(true)
            }
        }
    }

    const subscribe = useCallback(async () => {
        if (!vapidKey) return

        setLoading(true)
        try {
            const result = await Notification.requestPermission()
            setPermission(result)

            if (result !== 'granted') {
                setLoading(false)
                return
            }

            const registration = await navigator.serviceWorker.ready

            // Convert VAPID key
            const urlBase64ToUint8Array = (base64String: string) => {
                const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
                const base64 = (base64String + padding)
                    .replace(/-/g, '+')
                    .replace(/_/g, '/')
                const rawData = window.atob(base64)
                const outputArray = new Uint8Array(rawData.length)
                for (let i = 0; i < rawData.length; ++i) {
                    outputArray[i] = rawData.charCodeAt(i)
                }
                return outputArray
            }

            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(vapidKey),
            })

            // Send subscription to server
            const response = await fetch('/api/notifications/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    subscription: {
                        endpoint: subscription.endpoint,
                        keys: {
                            p256dh: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('p256dh')!))),
                            auth: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('auth')!))),
                        },
                    },
                }),
            })

            if (response.ok) {
                setIsSubscribed(true)
                setShowBanner(false)
            }
        } catch (error) {
            console.error('Error subscribing to push notifications:', error)
        } finally {
            setLoading(false)
        }
    }, [vapidKey])

    const dismissBanner = () => {
        setShowBanner(false)
        localStorage.setItem('push-notification-dismissed', 'true')
    }

    if (permission === 'unsupported') {
        return null
    }

    if (!showBanner && !isSubscribed) {
        return null
    }

    if (isSubscribed) {
        return (
            <div className={`flex items-center gap-2 text-sm text-green-600 dark:text-green-400 ${className}`}>
                <HiBell className="w-4 h-4" />
                <span>Notifikasi aktif</span>
            </div>
        )
    }

    if (permission === 'denied') {
        return (
            <div className={`flex items-center gap-2 text-sm text-gray-500 ${className}`}>
                <HiBellSlash className="w-4 h-4" />
                <span>Notifikasi diblokir</span>
            </div>
        )
    }

    return (
        <div className={`bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg p-4 ${className}`}>
            <div className="flex items-start gap-3">
                <div className="shrink-0">
                    <HiBell className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div className="flex-1">
                    <h3 className="font-medium text-gray-900 dark:text-white">
                        Aktifkan Notifikasi
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        Dapatkan pemberitahuan langsung saat ada Work Order baru atau update penting.
                    </p>
                    <div className="flex items-center gap-3 mt-3">
                        <button
                            onClick={subscribe}
                            disabled={loading}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                        >
                            {loading ? 'Mengaktifkan...' : 'Aktifkan Notifikasi'}
                        </button>
                        <button
                            onClick={dismissBanner}
                            className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                        >
                            Nanti saja
                        </button>
                    </div>
                </div>
                <button
                    onClick={dismissBanner}
                    className="shrink-0 p-1 hover:bg-indigo-100 dark:hover:bg-indigo-800 rounded"
                >
                    <HiXMark className="w-5 h-5 text-gray-500" />
                </button>
            </div>
        </div>
    )
}
