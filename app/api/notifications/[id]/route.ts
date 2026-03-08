import { NextRequest, NextResponse } from 'next/server';
import { getReadableNotificationForUser, markAsRead } from '@/modules/notification';
import { requireAuth } from '@/lib/auth-helpers';
import { getUserPermissions, isSuperAdmin } from '@/lib/auth';

// PATCH /api/notifications/[id] - Mark single notification as read
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await requireAuth(request);
        if (session instanceof NextResponse) {
            return session;
        }
        const { id } = await params;

        const permissions = await getUserPermissions(session.user.id);
        const siteId = !isSuperAdmin(session.user) && permissions.includes('site_only')
            ? session.user.siteId || undefined
            : undefined;

        const notification = await getReadableNotificationForUser(id, session.user.id, {
            departmentId: session.user.departmentId || undefined,
            siteId,
        });

        if (!notification) {
            return NextResponse.json(
                { error: 'Notifikasi tidak ditemukan' },
                { status: 404 }
            );
        }

        await markAsRead(id);

        return NextResponse.json({
            success: true,
            message: 'Notifikasi telah ditandai dibaca',
        });
    } catch (error) {
        console.error('Error marking notification as read:', error);
        return NextResponse.json(
            { error: 'Gagal menandai notifikasi sebagai dibaca' },
            { status: 500 }
        );
    }
}
