import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-helpers';
import { TargetAudience } from '@prisma/client';
import { getSocketServer } from '@/lib/websocket/server';
import { SOCKET_EVENTS } from '@/lib/websocket/types';

export async function GET(request: NextRequest) {
    try {
        const session = await requireAuth(request);
        if (session instanceof NextResponse) {
            return session;
        }
        const { searchParams } = new URL(request.url);

        const target = searchParams.get('target') as TargetAudience | undefined;
        const activeOnly = searchParams.get('active') === 'true';
        const portal = searchParams.get('portal'); // 'admin', 'customer', 'employee'

        // Base query
        let where: {
            target?: TargetAudience | { in: TargetAudience[] };
            isActive?: boolean;
            startDate?: { lte: Date };
            OR?: Array<{ endDate: null } | { endDate: { gte: Date } }>;
        } = {};

        // If accessed from a specific portal, filter accordingly
        if (portal === 'customer') {
            where = {
                target: { in: ['ALL', 'CUSTOMER'] },
                isActive: true,
                startDate: { lte: new Date() },
                OR: [
                    { endDate: null },
                    { endDate: { gte: new Date() } }
                ]
            };
        } else if (portal === 'employee') {
            where = {
                target: { in: ['ALL', 'EMPLOYEE'] },
                isActive: true,
                startDate: { lte: new Date() },
                OR: [
                    { endDate: null },
                    { endDate: { gte: new Date() } }
                ]
            };
        } else if (portal === 'admin') {
            // Admin portal might want to see announcements for admins
            where = {
                target: { in: ['ALL', 'ADMIN'] },
                isActive: true,
                startDate: { lte: new Date() },
                OR: [
                    { endDate: null },
                    { endDate: { gte: new Date() } }
                ]
            };
        } else {
            // Admin management view (shows everything)
            // Allow filtering if provided
            if (target) where.target = target;
            if (activeOnly) where.isActive = true;
        }


        const announcements = await prisma.announcement.findMany({
            where,
            orderBy: [
                { isPinned: 'desc' },
                { createdAt: 'desc' }
            ],
            include: {
                _count: {
                    select: { reads: true }
                }
            }
        });

        return NextResponse.json(announcements);

    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = await requireAuth(request);
        if (session instanceof NextResponse) {
            return session;
        }
        // Verify admin role if needed, assuming requireAuth checks login
        // if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

        const body = await request.json();
        const { title, content, target, isActive, isPinned, startDate, endDate } = body;

        const announcement = await prisma.announcement.create({
            data: {
                id: crypto.randomUUID(),
                title,
                content,
                target,
                isActive: isActive ?? true,
                isPinned: isPinned ?? false,
                startDate: startDate ? new Date(startDate) : new Date(), // Default to now if not provided

                endDate: endDate ? new Date(endDate) : null,
                createdBy: session.user.id,
                updatedAt: new Date()
            }
        });

        // Broadcast announcement via WebSocket to all connected clients
        const socketServer = getSocketServer();
        if (socketServer && isActive !== false) {
            // Broadcast to all connected clients (announcement is public)
            socketServer.emit(SOCKET_EVENTS.ANNOUNCEMENT_NEW, {
                id: announcement.id,
                title: announcement.title,
                content: announcement.content,
                target: announcement.target,
                isPinned: announcement.isPinned,
                createdAt: announcement.createdAt.toISOString(),
            });
            console.log('[WS] Broadcast announcement:', announcement.id);
        }

        // Send Push Notifications (Mobile)
        if (isActive !== false && target !== 'CUSTOMER') {
            try {
                // Determine user filter based on target
                const userFilter: {
                    pushToken: { not: null };
                    isActive: boolean;
                    Role?: { name: string | { in: string[] } };
                } = {
                    pushToken: { not: null },
                    isActive: true
                };

                if (target === 'EMPLOYEE') {
                    // Ensure we target employees (including technicians, etc if needed - adjusting to logical roles)
                    // For now, assuming distinct 'EMPLOYEE' role or just filtering non-admins if excluding, 
                    // but usually EMPLOYEE target means strictly employees.
                    // Let's assume Role name is key.
                    userFilter.Role = { name: { in: ['EMPLOYEE', 'TEKNISI', 'ADMIN'] } }; // Should probably include relevant staff
                } else if (target === 'ADMIN') {
                    userFilter.Role = { name: 'ADMIN' };
                }

                const users = await prisma.user.findMany({
                    where: userFilter,
                    select: { id: true, pushToken: true }
                });

                // 1. Send Push Notifications
                const tokens = users
                    .map(u => u.pushToken)
                    .filter((t): t is string => t !== null && t !== '');

                if (tokens.length > 0) {
                    const { sendExpoPushNotifications } = await import('@/lib/expo');
                    // Run in background to not block response? 
                    // Better to await to ensure it works, or at least catch errors.
                    await sendExpoPushNotifications(
                        tokens,
                        announcement.title,
                        announcement.content.substring(0, 100) + (announcement.content.length > 100 ? '...' : ''),
                        { announcementId: announcement.id, url: '/announcement' }
                    );
                    console.log(`[PUSH] Sent to ${tokens.length} devices`);
                }

                // 2. Create In-App Notifications (Database)
                // We create a notification record for ALL targeted users, regardless of push token
                const allTargetedUsers = await prisma.user.findMany({
                    where: { ...userFilter, pushToken: undefined }, // Remove pushToken filter for DB records
                    select: { id: true }
                });

                if (allTargetedUsers.length > 0) {
                    const notificationData = allTargetedUsers.map(user => ({
                        id: crypto.randomUUID(),
                        type: 'ANNOUNCEMENT',
                        title: announcement.title,
                        message: announcement.content.substring(0, 100) + (announcement.content.length > 100 ? '...' : ''),
                        userId: user.id,
                        sourceType: 'ANNOUNCEMENT',
                        sourceId: announcement.id,
                        isRead: false,
                        priority: 'NORMAL',
                        createdAt: new Date(),
                    }));

                    // Use singular 'notification' to match existing codebase usage
                    await prisma.notifications.createMany({
                        data: notificationData
                    });
                    console.log(`[DB] Created ${allTargetedUsers.length} notification records`);
                }
            } catch (pushError) {
                console.error('[PUSH] Failed to send push notifications:', pushError);
                // Don't fail the request if push fails
            }
        }

        return NextResponse.json(announcement);
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}
