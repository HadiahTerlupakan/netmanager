'use client'

import { useEffect } from 'react'

export default function PWAScript() {
  useEffect(() => {
    // Register Service Worker
    if ('serviceWorker' in navigator) {
      // Register immediately, don't wait for load
      navigator.serviceWorker
        .register('/pelanggan-sw.js')
        .then((registration) => {
          console.log('Service Worker registered:', registration.scope)
          
          // Check for updates periodically
          setInterval(() => {
            registration.update()
          }, 60 * 60 * 1000) // Check every hour
        })
        .catch((error) => {
          console.error('Service Worker registration failed:', error)
        })
    }

    // Handle app installed
    window.addEventListener('appinstalled', () => {
      console.log('PWA installed')
      // Clear any install prompts
      if (typeof window !== 'undefined') {
        localStorage.setItem('pwa-installed', 'true')
      }
    })

    // Check if running as PWA
    if (window.matchMedia('(display-mode: standalone)').matches) {
      console.log('Running as PWA')
      if (typeof window !== 'undefined') {
        localStorage.setItem('pwa-installed', 'true')
      }
    }
  }, [])

  return null
}

