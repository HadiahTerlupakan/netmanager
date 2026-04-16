/// <reference lib="webworker" />

// Custom Worker for Push Notifications
// This file will be injected into the main service worker by next-pwa

import { recoverPushSubscription } from "./pushSubscriptionRecovery";
import {
  applyNotificationClick,
  normalizePushNotificationPayload,
} from "./pushNotificationRuntime";

declare const self: ServiceWorkerGlobalScope;

let vapidPublicKey: string | null = null;

self.addEventListener("message", (event: ExtendableMessageEvent) => {
  if (
    event.data?.type === "PUSH_CONFIG" &&
    typeof event.data.vapidPublicKey === "string"
  ) {
    vapidPublicKey = event.data.vapidPublicKey;
  }
});

// Push notification event handler
self.addEventListener("push", (event: PushEvent) => {
  console.log("[SW] Push notification received");

  let notificationData = {
    title: "NetManager",
    body: "You have a new notification",
    icon: "/icons/icon-192x192.png",
    badge: "/icons/icon-72x72.png",
    data: {} as Record<string, unknown>,
  };

  try {
    if (event.data) {
      const payload = event.data.json();
      notificationData = normalizePushNotificationPayload(payload);
    }
  } catch (error) {
    console.error("[SW] Error parsing push data:", error);
    if (event.data) {
      notificationData.body = event.data.text();
    }
  }

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

  if (event.action === "open" || !event.action) {
    event.waitUntil(
      self.clients
        .matchAll({ type: "window", includeUncontrolled: true })
        .then((clientList) =>
          applyNotificationClick({
            clients: clientList,
            notificationData: { url: data?.url },
            openWindow: self.clients.openWindow?.bind(self.clients),
          }),
        ),
    );
  }
});

// Notification close event handler
self.addEventListener("notificationclose", (event: NotificationEvent) => {
  console.log("[SW] Notification closed:", event.notification.tag);
});

self.addEventListener("pushsubscriptionchange", (event: Event) => {
  console.log("[SW] Push subscription changed");
  (event as ExtendableEvent).waitUntil(
    recoverPushSubscription({
      vapidPublicKey,
      subscribe: (options) => self.registration.pushManager.subscribe(options),
      fetchImpl: fetch,
    }).catch((error) => {
      console.error("[SW] Failed to recover push subscription:", error);
      return false;
    }),
  );
});

export {};
