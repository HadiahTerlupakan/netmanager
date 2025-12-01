'use client'

import { useEffect, useState } from 'react'

export function usePWA() {
    const [isInstalled, setIsInstalled] = useState(false)
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null)

    useEffect(() => {
        // Check if already installed
        if (window.matchMedia('(display-mode: standalone)').matches) {
            setIsInstalled(true)
        }

        // Only register service worker in production (PWA is disabled in development)
        if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
            navigator.serviceWorker
                .register('/sw.js')
                .then((registration) => {
                    console.log('Service Worker registered:', registration)
                })
                .catch((error) => {
                    console.error('Service Worker registration failed:', error)
                })
        }

        // Listen for install prompt (only in production)
        const handleBeforeInstallPrompt = (e: Event) => {
            // Only prevent default if we're going to use the prompt
            // In development, let browser handle it naturally to avoid warnings
            if (process.env.NODE_ENV === 'production') {
                e.preventDefault()
                setDeferredPrompt(e)
            }
            // In development, don't prevent default - let browser show native prompt
        }

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

        // Listen for app installed
        window.addEventListener('appinstalled', () => {
            setIsInstalled(true)
            setDeferredPrompt(null)
        })

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
        }
    }, [])

    const installPWA = async () => {
        if (!deferredPrompt) return false

        deferredPrompt.prompt()
        const { outcome } = await deferredPrompt.userChoice

        if (outcome === 'accepted') {
            setDeferredPrompt(null)
            return true
        }

        return false
    }

    return {
        isInstalled,
        canInstall: !!deferredPrompt,
        installPWA,
    }
}
