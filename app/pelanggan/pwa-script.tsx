'use client'

import { useEffect } from 'react'

export default function PWAScript() {
  useEffect(() => {
    // Register Service Worker
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/pelanggan-sw.js')
          .then((registration) => {
            console.log('Service Worker registered:', registration.scope)
          })
          .catch((error) => {
            console.error('Service Worker registration failed:', error)
          })
      })
    }

    // Handle PWA install prompt
    let deferredPrompt: any = null

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault()
      deferredPrompt = e
      // You can show a custom install button here
      console.log('PWA install prompt available')
    })

    // Handle app installed
    window.addEventListener('appinstalled', () => {
      console.log('PWA installed')
      deferredPrompt = null
    })
  }, [])

  return null
}

