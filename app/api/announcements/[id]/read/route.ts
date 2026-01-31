import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-helpers';

// Mark an announcement as read
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await requireAuth(request);
        if (session instanceof NextResponse) {
            return session;
        }
        const { id } = await params;
        const body = await request.json().catch(() => ({}));
        const portal = body.portal || 'admin';

        // Check if announcement exists
        const announcement = await prisma.announcement.findUnique({
            where: { id }
        });

        if (!announcement) {
            return NextResponse.json(
                { error: 'Announcement not found' },
                { status: 404 }
            );
        }

        // Upsert the read record (idempotent)
        const read = await prisma.announcementRead.upsert({
            where: {
                announcementId_userId: {
                    announcementId: id,
                    userId: session.user.id
                }
            },
            update: {
                readAt: new Date()
            },
            create: {
                announcementId: id,
                userId: session.user.id,
                portal: portal
            }
        });

        return NextResponse.json({
            success: true,
            read
        });

    } catch (error) {
        console.error('Mark announcement read error:', error);
        return NextResponse.json(
            { error: String(error) },
            { status: 500 }
        );
    }
}

// Get read statistics for an announcement
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await requireAuth(request);
        if (session instanceof NextResponse) {
            return session;
        }
        const { id } = await params;

        const [announcement, readCount, recentReaders] = await Promise.all([
            prisma.announcement.findUnique({
                where: { id },
                select: { id: true, title: true, target: true }
            }),
            prisma.announcementRead.count({
                where: { announcementId: id }
            }),
            prisma.announcementRead.findMany({
                where: { announcementId: id },
                orderBy: { readAt: 'desc' },
                take: 10,
                include: {
                    announcement: false
                }
            })
        ]);

        if (!announcement) {
            return NextResponse.json(
                { error: 'Announcement not found' },
                { status: 404 }
            );
        }

        // Get user/pelanggan names for recent readers
        const userIds = recentReaders.filter(r => r.userId).map(r => r.userId!);
        const pelangganIds = recentReaders.filter(r => r.pelangganId).map(r => r.pelangganId!);

        const [users, pelanggans] = await Promise.all([
            userIds.length > 0 ? prisma.user.findMany({
                where: { id: { in: userIds } },
                select: { id: true, name: true }
            }) : [],
            pelangganIds.length > 0 ? prisma.pelanggan.findMany({
                where: { id: { in: pelangganIds } },
                select: { id: true, nama: true }
            }) : []
        ]);

        const userMap = new Map(users.map(u => [u.id, u.name]));
        const pelangganMap = new Map(pelanggans.map(p => [p.id, p.nama]));

        const readersWithNames = recentReaders.map(r => ({
            ...r,
            readerName: r.userId 
                ? userMap.get(r.userId) || 'Unknown User'
                : r.pelangganId 
                    ? pelangganMap.get(r.pelangganId) || 'Unknown Customer'
                    : 'Anonymous'
        }));

        return NextResponse.json({
            announcement,
            readCount,
            recentReaders: readersWithNames
        });

    } catch (error) {
        console.error('Get announcement read stats error:', error);
        return NextResponse.json(
            { error: String(error) },
            { status: 500 }
        );
    }
}
