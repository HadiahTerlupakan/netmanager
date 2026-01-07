import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authConfig } from '@/lib/auth';
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

        const count = await getUnreadCount(session.user.id, excludeTypes);

        return NextResponse.json({ count });
    } catch (error) {
        console.error('Error fetching unread count:', error);
        return NextResponse.json({ count: 0 });
    }
}
