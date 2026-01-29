'use client'

import { useEffect, useState, useCallback } from 'react'

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function usePWA() {
    const [isInstalled, setIsInstalled] = useState(() => {
        if (typeof window !== 'undefined') {
            return window.matchMedia('(display-mode: standalone)').matches
        }
        return false
    })
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
    const [isReady, setIsReady] = useState(false)

    useEffect(() => {
        // Debug log
        console.log('[PWA] Initializing PWA hook...')
        console.log('[PWA] Environment:', process.env.NODE_ENV)
        console.log('[PWA] Pathname:', window.location.pathname)

        // Check if already installed (just for logging now)
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches
        console.log('[PWA] Is standalone mode:', isStandalone)


        // Register service worker IMMEDIATELY (not delayed)
        const isLoginPage = window.location.pathname.includes('/login')

        if ('serviceWorker' in navigator && !isLoginPage) {
            console.log('[PWA] Registering service worker...')
            navigator.serviceWorker
                .register('/sw.js')
                .then((registration) => {
                    console.log('[PWA] Service Worker registered successfully:', registration.scope)
                    setIsReady(true)
                })
                .catch((error) => {
                    console.error('[PWA] Service Worker registration failed:', error)
                })
        } else {
            console.log('[PWA] Service worker not available or on login page')
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setIsReady(true)
        }

        // Listen for install prompt - this must be attached IMMEDIATELY
        const handleBeforeInstallPrompt = (e: Event) => {
            console.log('[PWA] beforeinstallprompt event fired!')
            e.preventDefault()
            setDeferredPrompt(e as BeforeInstallPromptEvent)
        }

        // Attach listener immediately
        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
        console.log('[PWA] beforeinstallprompt listener attached')

        // Listen for app installed
        const handleAppInstalled = () => {
            console.log('[PWA] App was installed!')
            setIsInstalled(true)
            setDeferredPrompt(null)
        }
        window.addEventListener('appinstalled', handleAppInstalled)

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
            window.removeEventListener('appinstalled', handleAppInstalled)
        }
    }, [])

    const installPWA = useCallback(async () => {
        console.log('[PWA] Install button clicked, deferredPrompt:', !!deferredPrompt)

        if (!deferredPrompt) {
            console.log('[PWA] No deferred prompt available')
            return false
        }

        try {
            console.log('[PWA] Showing install prompt...')
            await deferredPrompt.prompt()
            const { outcome } = await deferredPrompt.userChoice
            console.log('[PWA] User choice:', outcome)

            if (outcome === 'accepted') {
                setDeferredPrompt(null)
                return true
            }
        } catch (error) {
            console.error('[PWA] Error during install:', error)
        }

        return false
    }, [deferredPrompt])

    return {
        isInstalled,
        canInstall: !!deferredPrompt,
        isReady,
        installPWA,
    }
}

