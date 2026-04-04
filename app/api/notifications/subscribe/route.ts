import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authConfig } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { subscribeDevice } from '@/modules/notification';
import { getVapidPublicKey, isPushConfigured } from '@/modules/notification';
import { apiSuccess, ApiErrors, ErrorCodes, apiError } from '@/lib/api-response';

// GET /api/notifications/subscribe - Get VAPID public key
export async function GET() {
    if (!isPushConfigured()) {
        return apiError('Push notifications tidak dikonfigurasi', ErrorCodes.EXTERNAL_SERVICE_ERROR, { status: 503 })
    }

    return apiSuccess({
        publicKey: getVapidPublicKey(),
    })
}

// POST /api/notifications/subscribe - Subscribe device for push notifications
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authConfig);

        if (!session?.user?.id) {
            return ApiErrors.unauthorized('Session tidak valid')
        }

        if (!isPushConfigured()) {
            return apiError('Push notifications tidak dikonfigurasi', ErrorCodes.EXTERNAL_SERVICE_ERROR, { status: 503 })
        }

        const body = await request.json();

        if (!body.subscription || !body.subscription.endpoint || !body.subscription.keys) {
            return apiError('Data subscription tidak valid', ErrorCodes.VALIDATION_ERROR, { status: 400 })
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

        return apiSuccess({ subscriptionId: subscription.id }, { message: 'Device berhasil di-subscribe untuk push notifications' })
    } catch (error) {
        console.error('Error subscribing device:', error);
        return ApiErrors.internalError('Gagal subscribe device')
    }
}

// DELETE /api/notifications/subscribe - Unsubscribe device
export async function DELETE(request: NextRequest) {
    try {
        const session = await getServerSession(authConfig);

        if (!session || !session.user) {
            return ApiErrors.unauthorized('Session tidak valid')
        }

        const body = await request.json();

        if (!body.endpoint) {
            return apiError('Endpoint harus diisi', ErrorCodes.VALIDATION_ERROR, { status: 400 })
        }

        await prisma.pushSubscriptions.updateMany({
            where: {
                endpoint: body.endpoint,
                userId: session.user.id,
            },
            data: { isActive: false },
        });

        return apiSuccess(null, { message: 'Device berhasil di-unsubscribe dari push notifications' })
    } catch (error) {
        console.error('Error unsubscribing device:', error);
        return ApiErrors.internalError('Gagal unsubscribe device')
    }
}
