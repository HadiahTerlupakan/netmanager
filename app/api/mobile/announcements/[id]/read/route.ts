import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getMobileAuthPayload } from '@/lib/mobile-api-auth';

// Mark an announcement as read from mobile app
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const authResult = await getMobileAuthPayload(request);
        if (authResult instanceof NextResponse) {
            return authResult;
        }

        const payload = authResult;
        const userId = payload.sub as string;
        const { id: announcementId } = await params;
        const body = await request.json().catch(() => ({}));
        const portal = body.portal || 'mobile';

        // Check if announcement exists
        const announcement = await prisma.announcement.findUnique({
            where: { id: announcementId }
        });

        if (!announcement) {
            return NextResponse.json(
                { error: 'Pengumuman tidak ditemukan' },
                { status: 404 }
            );
        }

        // Upsert the read record (idempotent)
        const read = await prisma.announcementRead.upsert({
            where: {
                announcementId_userId: {
                    announcementId: announcementId,
                    userId: userId
                }
            },
            update: {
                readAt: new Date()
            },
            create: {
                announcementId: announcementId,
                userId: userId,
                portal: portal
            }
        });

        // console.log(`[Mobile] Announcement ${announcementId} marked as read by user ${userId}`);

        return NextResponse.json({
            success: true,
            read
        });

    } catch (error) {
        console.error('Mobile mark announcement read error:', error);
        return NextResponse.json(
            { error: String(error) },
            { status: 500 }
        );
    }
}
