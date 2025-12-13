/// <reference lib="webworker" />

// Custom Worker for Push Notifications
// This file will be injected into the main service worker by next-pwa

declare const self: ServiceWorkerGlobalScope;

// Push notification event handler
self.addEventListener('push', (event: PushEvent) => {
    console.log('[SW] Push notification received');

    let notificationData = {
        title: 'NetManager',
        body: 'You have a new notification',
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-72x72.png',
        data: {} as Record<string, unknown>,
    };

    try {
        if (event.data) {
            const payload = event.data.json();
            notificationData = {
                title: payload.title || 'NetManager',
                body: payload.body || 'You have a new notification',
                icon: payload.icon || '/icons/icon-192x192.png',
                badge: payload.badge || '/icons/icon-72x72.png',
                data: payload.data || {},
            };
        }
    } catch (error) {
        console.error('[SW] Error parsing push data:', error);
        if (event.data) {
            notificationData.body = event.data.text();
        }
    }

    const options: NotificationOptions = {
        body: notificationData.body,
        icon: notificationData.icon,
        badge: notificationData.badge,
        data: notificationData.data,
        tag: (notificationData.data as { tag?: string }).tag || 'default',
        requireInteraction: (notificationData.data as { requireInteraction?: boolean }).requireInteraction || false,
    };

    event.waitUntil(
        self.registration.showNotification(notificationData.title, options)
    );
});

// Notification click event handler
self.addEventListener('notificationclick', (event: NotificationEvent) => {
    console.log('[SW] Notification clicked');
    event.notification.close();

    const data = event.notification.data as { url?: string };
    let targetUrl = '/employee/notifications';

    if (event.action === 'open' || !event.action) {
        if (data?.url) {
            targetUrl = data.url;
        }

        event.waitUntil(
            self.clients.matchAll({ type: 'window', includeUncontrolled: true })
                .then((clientList) => {
                    // Check if there's already an open window
                    for (const client of clientList) {
                        if (client.url.includes('/employee') && 'focus' in client) {
                            client.navigate(targetUrl);
                            return client.focus();
                        }
                    }
                    // Open a new window if none exists
                    if (self.clients.openWindow) {
                        return self.clients.openWindow(targetUrl);
                    }
                    return null;
                })
                .then(() => { /* void return for event.waitUntil */ })
        );
    }
});

// Notification close event handler
self.addEventListener('notificationclose', (event: NotificationEvent) => {
    console.log('[SW] Notification closed:', event.notification.tag);
});

// Push subscription change event handler
self.addEventListener('pushsubscriptionchange', (event) => {
    console.log('[SW] Push subscription changed');
    // Re-subscribe logic can be added here
});

export { };
