import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authConfig } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { subscribeDevice } from '@/lib/services/NotificationService';
import { getVapidPublicKey, isPushConfigured } from '@/lib/services/PushNotificationService';

// GET /api/notifications/subscribe - Get VAPID public key
export async function GET() {
    if (!isPushConfigured()) {
        return NextResponse.json(
            { error: 'Push notifications not configured' },
            { status: 503 }
        );
    }

    return NextResponse.json({
        publicKey: getVapidPublicKey(),
    });
}

// POST /api/notifications/subscribe - Subscribe device for push notifications
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authConfig);

        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!isPushConfigured()) {
            return NextResponse.json(
                { error: 'Push notifications not configured' },
                { status: 503 }
            );
        }

        const body = await request.json();

        if (!body.subscription || !body.subscription.endpoint || !body.subscription.keys) {
            return NextResponse.json(
                { error: 'Invalid subscription data' },
                { status: 400 }
            );
        }

        const subscription = await subscribeDevice(
            session.user.id!,
            {
                endpoint: body.subscription.endpoint,
                keys: {
                    p256dh: body.subscription.keys.p256dh,
                    auth: body.subscription.keys.auth,
                },
            },
            request.headers.get('user-agent') || undefined
        );

        return NextResponse.json({
            success: true,
            message: 'Device subscribed for push notifications',
            subscriptionId: subscription.id,
        });
    } catch (error) {
        console.error('Error subscribing device:', error);
        return NextResponse.json(
            { error: 'Failed to subscribe device' },
            { status: 500 }
        );
    }
}

// DELETE /api/notifications/subscribe - Unsubscribe device
export async function DELETE(request: NextRequest) {
    try {
        const session = await getServerSession(authConfig);

        if (!session || !session.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();

        if (!body.endpoint) {
            return NextResponse.json(
                { error: 'Endpoint is required' },
                { status: 400 }
            );
        }

        await prisma.pushSubscription.updateMany({
            where: { endpoint: body.endpoint },
            data: { isActive: false },
        });

        return NextResponse.json({
            success: true,
            message: 'Device unsubscribed from push notifications',
        });
    } catch (error) {
        console.error('Error unsubscribing device:', error);
        return NextResponse.json(
            { error: 'Failed to unsubscribe device' },
            { status: 500 }
        );
    }
}
