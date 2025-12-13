import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authConfig } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
    getNotificationsForEmployee,
    getUnreadCount,
    markAllAsRead,
} from '@/lib/services/NotificationService';

// GET /api/notifications - Get notifications for current user
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authConfig);

        if (!session || !session.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get employee ID from session
        const employee = await prisma.employee.findUnique({
            where: { userId: session.user.id },
            select: { id: true },
        });

        if (!employee) {
            return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
        }

        const { searchParams } = new URL(request.url);
        const unreadOnly = searchParams.get('unread') === 'true';
        const limit = parseInt(searchParams.get('limit') || '50');
        const offset = parseInt(searchParams.get('offset') || '0');

        const { notifications, total } = await getNotificationsForEmployee(
            employee.id,
            { unreadOnly, limit, offset }
        );

        const unreadCount = await getUnreadCount(employee.id);

        return NextResponse.json({
            success: true,
            notifications,
            total,
            unreadCount,
        });
    } catch (error) {
        console.error('Error fetching notifications:', error);
        return NextResponse.json(
            { error: 'Failed to fetch notifications' },
            { status: 500 }
        );
    }
}

// PATCH /api/notifications - Mark all as read
export async function PATCH(request: NextRequest) {
    try {
        const session = await getServerSession(authConfig);

        if (!session || !session.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const employee = await prisma.employee.findUnique({
            where: { userId: session.user.id },
            select: { id: true },
        });

        if (!employee) {
            return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
        }

        await markAllAsRead(employee.id);

        return NextResponse.json({
            success: true,
            message: 'All notifications marked as read',
        });
    } catch (error) {
        console.error('Error marking notifications as read:', error);
        return NextResponse.json(
            { error: 'Failed to mark notifications as read' },
            { status: 500 }
        );
    }
}
