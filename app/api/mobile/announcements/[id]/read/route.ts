import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/modules/database';
import { getMobileAuthPayload } from '@/lib/mobile-api-auth';
import { apiError, ErrorCodes } from '@/lib/api-response';

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

        const payload = authResult
        const tenantId = payload.tenantId as string;
        const userId = payload.sub as string;
        const { id: announcementId } = await params;
        const body = await request.json().catch(() => ({}));
        const portal = body.portal || 'mobile';

        // Check if announcement exists
        const announcement = await prisma.announcement.findFirst({
            where: { 
                id: announcementId,
                tenantId: tenantId
            }
        });

        if (!announcement) {
            return apiError('Pengumuman tidak ditemukan', ErrorCodes.NOT_FOUND, { status: 404 });
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
                portal: portal,
                tenantId: tenantId
            }
        });

        // console.log(`[Mobile] Announcement ${announcementId} marked as read by user ${userId}`);

        return NextResponse.json({
            success: true,
            read
        });

    } catch (error) {
        console.error('Mobile mark announcement read error:', error);
        return apiError(
            'Terjadi kesalahan server',
            ErrorCodes.INTERNAL_ERROR,
            { status: 500 }
        );
    }
}
