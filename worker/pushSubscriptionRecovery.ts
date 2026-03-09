import type { PushSubscriptionData } from '@/modules/notification/services/PushNotificationService';

interface RecoverPushSubscriptionOptions {
    vapidPublicKey?: string | null;
    subscribe: (options: PushSubscriptionOptionsInit) => Promise<PushSubscription>;
    fetchImpl: typeof fetch;
    applicationServerKey?: BufferSource;
}

function urlBase64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
        .replace(/-/g, '+')
        .replace(/_/g, '/');
    const rawData = atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

function serializeSubscription(subscription: PushSubscription): PushSubscriptionData {
    const json = subscription.toJSON();
    return {
        endpoint: subscription.endpoint,
        keys: {
            p256dh: json.keys?.p256dh || '',
            auth: json.keys?.auth || '',
        },
    };
}

export async function recoverPushSubscription({
    vapidPublicKey,
    subscribe,
    fetchImpl,
    applicationServerKey,
}: RecoverPushSubscriptionOptions) {
    if (!vapidPublicKey) {
        return false;
    }

    const subscription = await subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey || urlBase64ToUint8Array(vapidPublicKey),
    });

    const response = await fetchImpl('/api/notifications/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            subscription: serializeSubscription(subscription),
        }),
    });

    return response.ok;
}
