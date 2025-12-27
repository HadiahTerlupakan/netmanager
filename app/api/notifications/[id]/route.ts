import { NextRequest, NextResponse } from 'next/server';
import { markAsRead } from '@/modules/notification';
import { requireAuth } from '@/lib/auth-helpers';
import { prisma } from '@/lib/prisma';

// PATCH /api/notifications/[id] - Mark single notification as read
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await requireAuth(request);
        const { id } = await params;

        // Verify notification belongs to user
        const notification = await prisma.notifications.findUnique({
            where: { id },
            select: { userId: true }
        });

        if (!notification) {
            return NextResponse.json(
                { error: 'Notification not found' },
                { status: 404 }
            );
        }

        if (notification.userId && notification.userId !== session.user.id) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 403 }
            );
        }

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
