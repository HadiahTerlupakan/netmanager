import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authConfig } from '@/lib/auth';
import { markAsRead } from '@/modules/notification';
import { apiSuccess, ApiErrors } from '@/lib/api-response';

// PATCH /api/notifications/[id]/read - Mark notification as read
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authConfig);

        if (!session || !session.user) {
            return ApiErrors.unauthorized('Session tidak valid')
        }

        const { id } = await params;

        await markAsRead(id);

        return apiSuccess(null, { message: 'Notifikasi ditandai telah dibaca' })
    } catch (error) {
        console.error('Error marking notification as read:', error);
        return ApiErrors.internalError('Gagal menandai notifikasi sebagai dibaca')
    }
}
