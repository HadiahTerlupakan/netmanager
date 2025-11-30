// Service Worker for Employee Portal PWA
const CACHE_NAME = 'netmanager-employee-v1'
const OFFLINE_URL = '/employee/offline'

const urlsToCache = [
    '/employee',
    '/employee/attendance',
    '/employee/leaves',
    '/employee/payslips',
    '/employee/profile',
    '/employee/offline',
]

// Install event - cache resources
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('Opened cache')
            return cache.addAll(urlsToCache)
        })
    )
    self.skipWaiting()
})

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Deleting old cache:', cacheName)
                        return caches.delete(cacheName)
                    }
                })
            )
        })
    )
    self.clients.claim()
})

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
    // Skip non-GET requests
    if (event.request.method !== 'GET') return

    // Skip chrome-extension and other non-http requests
    if (!event.request.url.startsWith('http')) return

    event.respondWith(
        caches.match(event.request).then((response) => {
            // Cache hit - return response
            if (response) {
                return response
            }

            return fetch(event.request)
                .then((response) => {
                    // Check if we received a valid response
                    if (!response || response.status !== 200 || response.type !== 'basic') {
                        return response
                    }

                    // Clone the response
                    const responseToCache = response.clone()

                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseToCache)
                    })

                    return response
                })
                .catch(() => {
                    // Return offline page for navigation requests
                    if (event.request.mode === 'navigate') {
                        return caches.match(OFFLINE_URL)
                    }
                })
        })
    )
})

// Background sync for attendance check-in/out
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-attendance') {
        event.waitUntil(syncAttendance())
    }
})

async function syncAttendance() {
    // Get pending attendance data from IndexedDB
    // Sync with server when online
    console.log('Syncing attendance data...')
}

// Push notification support
self.addEventListener('push', (event) => {
    const options = {
        body: event.data ? event.data.text() : 'New notification',
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-72x72.png',
        vibrate: [200, 100, 200],
        data: {
            dateOfArrival: Date.now(),
            primaryKey: 1,
        },
        actions: [
            {
                action: 'explore',
                title: 'View',
            },
            {
                action: 'close',
                title: 'Close',
            },
        ],
    }

    event.waitUntil(self.registration.showNotification('Employee Portal', options))
})

// Notification click
self.addEventListener('notificationclick', (event) => {
    event.notification.close()

    if (event.action === 'explore') {
        event.waitUntil(clients.openWindow('/employee'))
    }
})
