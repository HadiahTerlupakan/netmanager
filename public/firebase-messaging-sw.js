self.addEventListener('push', function (event) {
    if (event.data) {
        const data = event.data.json();

        let displayTitle = 'Pemberitahuan Baru';
        let displayOptions = {
            icon: '/icon-192x192.png',
            badge: '/icon-192x192.png',
            data: { url: '/' }
        };

        if (data.notification) {
            displayTitle = data.notification.title || displayTitle;
            displayOptions.body = data.notification.body;
            if (data.notification.click_action) displayOptions.data.url = data.notification.click_action;
        } else if (data.data) {
            displayTitle = data.data.title || displayTitle;
            displayOptions.body = data.data.body || data.data.message;
            if (data.data.url) displayOptions.data.url = data.data.url;
        }

        event.waitUntil(
            self.registration.showNotification(displayTitle, displayOptions)
        );
    }
});

self.addEventListener('notificationclick', function (event) {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
            if (clientList.length > 0) {
                let client = clientList[0];
                for (let i = 0; i < clientList.length; i++) {
                    if (clientList[i].focused) {
                        client = clientList[i];
                    }
                }
                if ('focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(event.notification.data.url);
            }
        })
    );
});
