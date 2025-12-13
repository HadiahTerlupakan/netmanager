import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authConfig } from '@/lib/auth';
import { markAsRead } from '@/lib/services/NotificationService';

// PATCH /api/notifications/[id]/read - Mark notification as read
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authConfig);

        if (!session || !session.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;

        await markAsRead(id);

        return NextResponse.json({
            success: true,
            message: 'Notification marked as read',
        });
    } catch (error) {
        console.error('Error marking notification as read:', error);
        return NextResponse.json(
            { error: 'Failed to mark notification as read' },
            { status: 500 }
        );
    }
}
