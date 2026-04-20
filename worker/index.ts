/// <reference lib="webworker" />

// Custom Worker for Push Notifications
// This file will be injected into the main service worker by next-pwa

import {
  handleNotificationClickAction,
  resolvePushNotificationPayloadFromEventData,
} from "./pushNotificationRuntime";

declare const self: ServiceWorkerGlobalScope;

// Push notification event handler
self.addEventListener("push", (event: PushEvent) => {
  console.log("[SW] Push notification received");

  const notificationData = resolvePushNotificationPayloadFromEventData(
    event.data,
  );
  const options: NotificationOptions = {
    body: notificationData.body,
    icon: notificationData.icon,
    badge: notificationData.badge,
    data: notificationData.data,
    tag: (notificationData.data as { tag?: string }).tag || "default",
    requireInteraction:
      (notificationData.data as { requireInteraction?: boolean })
        .requireInteraction || false,
  };

  event.waitUntil(
    self.registration.showNotification(notificationData.title, options),
  );
});

// Notification click event handler
self.addEventListener("notificationclick", (event: NotificationEvent) => {
  console.log("[SW] Notification clicked");
  event.notification.close();

  const data = event.notification.data as { url?: string };

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) =>
        handleNotificationClickAction({
          action: event.action,
          clients: clientList,
          notificationData: { url: data?.url },
          openWindow: self.clients.openWindow?.bind(self.clients),
        }),
      ),
  );
});

// Notification close event handler
self.addEventListener("notificationclose", (event: NotificationEvent) => {
  console.log("[SW] Notification closed:", event.notification.tag);
});

export {};
