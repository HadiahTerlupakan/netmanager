'use client'

import { useState, useEffect, useCallback } from 'react'
import { MdNotifications, MdNotificationsOff, MdClose } from 'react-icons/md'
import { Button } from '@/components/ui/Button'

export function KaryawanPushNotification() {
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
            const registration = await navigator.serviceWorker.ready
            const subscription = await registration.pushManager.getSubscription()
            setIsSubscribed(!!subscription)
        } else if (currentPermission === 'default') {
            const dismissed = localStorage.getItem('karyawan-push-dismissed')
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
            console.error('Error subscribing:', error)
        } finally {
            setLoading(false)
        }
    }, [vapidKey])

    const dismissBanner = () => {
        setShowBanner(false)
        localStorage.setItem('karyawan-push-dismissed', 'true')
    }

    if (permission === 'unsupported') {
        return null
    }

    if (isSubscribed) {
        return (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                <MdNotifications className="text-lg" />
                <span className="text-sm font-medium">Notifikasi aktif</span>
            </div>
        )
    }

    if (permission === 'denied') {
        return (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500">
                <MdNotificationsOff className="text-lg" />
                <span className="text-sm">Notifikasi diblokir</span>
            </div>
        )
    }

    if (!showBanner) {
        return (
            <Button onClick={subscribe}
                disabled={loading}
                
            >
                <MdNotifications className="text-lg" />
                <span className="text-sm font-medium">{loading ? 'Loading...' : 'Aktifkan Notifikasi'}</span>
            </Button>
        )
    }

    return (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
            <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center shrink-0">
                    <MdNotifications className="text-xl text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                        Aktifkan Notifikasi
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        Dapatkan notifikasi saat ada Work Order baru!
                    </p>
                    <div className="flex items-center gap-3 mt-3">
                        <Button onClick={subscribe}
                            disabled={loading}
                            
                        >
                            {loading ? 'Mengaktifkan...' : 'Aktifkan'}
                        </Button>
                        <Button onClick={dismissBanner}
                            
                        >
                            Nanti
                        </Button>
                    </div>
                </div>
                <Button onClick={dismissBanner}
                    
                >
                    <MdClose className="text-xl text-gray-400" />
                </Button>
            </div>
        </div>
    )
}
