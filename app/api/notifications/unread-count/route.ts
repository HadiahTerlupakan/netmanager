import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authConfig, getUserPermissions } from '@/lib/auth';
import { getUnreadCount, type NotificationType } from '@/modules/notification';

// GET /api/notifications/unread-count - Get unread notification count
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authConfig);

        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const excludeTypes = searchParams.get('excludeTypes')?.split(',') as NotificationType[] | undefined;

        // Enforce Site Restriction
        // const permissions = (session.user as any).permissions || []
        const permissions = await getUserPermissions(session.user.id);
        const isSuperAdmin = (session.user as any).role === 'SUPER_ADMIN'
        const siteId = (!isSuperAdmin && permissions.includes('site_only'))
            ? (session.user as any).siteId
            : undefined;

        const count = await getUnreadCount(session.user.id, excludeTypes, siteId);

        return NextResponse.json({ count });
    } catch (error) {
        console.error('Error fetching unread count:', error);
        return NextResponse.json({ count: 0 });
    }
}
