import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authConfig } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getUnreadCount } from '@/lib/services/NotificationService';

// GET /api/notifications/unread-count - Get unread notification count
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
            return NextResponse.json({ count: 0 });
        }

        const count = await getUnreadCount(employee.id);

        return NextResponse.json({ count });
    } catch (error) {
        console.error('Error fetching unread count:', error);
        return NextResponse.json({ count: 0 });
    }
}
