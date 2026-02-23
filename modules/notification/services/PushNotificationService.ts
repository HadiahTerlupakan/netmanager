import webpush from 'web-push';

// VAPID keys configuration
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@netmanager.local';

// Configure web-push with VAPID keys
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
        VAPID_SUBJECT,
        VAPID_PUBLIC_KEY,
        VAPID_PRIVATE_KEY
    );
}

export interface PushPayload {
    title: string;
    body: string;
    icon?: string;
    badge?: string;
    data?: {
        url?: string;
        type?: string;
        sourceId?: string;
        [key: string]: unknown;
    };
    tag?: string;
    requireInteraction?: boolean;
}

export interface PushSubscriptionData {
    endpoint: string;
    keys: {
        p256dh: string;
        auth: string;
    };
}

/**
 * Send push notification to a subscription
 */
export async function sendPushNotification(
    subscription: PushSubscriptionData,
    payload: PushPayload
): Promise<boolean> {
    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
        console.warn('VAPID keys not configured, skipping push notification');
        return false;
    }

    try {
        const pushSubscription = {
            endpoint: subscription.endpoint,
            keys: {
                p256dh: subscription.keys.p256dh,
                auth: subscription.keys.auth,
            },
        };

        const notificationPayload = JSON.stringify({
            title: payload.title,
            body: payload.body,
            icon: payload.icon || '/icons/icon-192x192.png',
            badge: payload.badge || '/icons/icon-72x72.png',
            data: payload.data || {},
            tag: payload.tag,
            requireInteraction: payload.requireInteraction || false,
        });

        await webpush.sendNotification(pushSubscription, notificationPayload);
        return true;
    } catch (error: unknown) {
        const webPushError = error as { statusCode?: number; message?: string };
        if (webPushError.statusCode === 410) {
            // Subscription expired or unsubscribed
            // console.log('Push subscription expired:', subscription.endpoint);
            return false;
        }
        console.error('Error sending push notification:', webPushError.message || error);
        throw error;
    }
}

/**
 * Send push notifications to multiple subscriptions
 * Returns array of results with success/failure status
 */
export async function sendPushNotifications(
    subscriptions: PushSubscriptionData[],
    payload: PushPayload
): Promise<{ endpoint: string; success: boolean; error?: string }[]> {
    const results = await Promise.allSettled(
        subscriptions.map(async (subscription) => {
            const success = await sendPushNotification(subscription, payload);
            return { endpoint: subscription.endpoint, success };
        })
    );

    return results.map((result, index) => {
        if (result.status === 'fulfilled') {
            return result.value;
        }
        return {
            endpoint: subscriptions[index].endpoint,
            success: false,
            error: (result.reason as Error)?.message || 'Terjadi kesalahan',
        };
    });
}

/**
 * Get VAPID public key for client-side subscription
 */
export function getVapidPublicKey(): string {
    return VAPID_PUBLIC_KEY;
}

/**
 * Check if push notifications are properly configured
 */
export function isPushConfigured(): boolean {
    return Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);
}
