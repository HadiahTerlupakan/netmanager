import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyMobileToken } from '@/lib/mobile-auth';

// Mark an announcement as read from mobile app
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        // Get token from Authorization header
        const authHeader = request.headers.get('Authorization');
        // console.log('[Mobile Announcement Read] Auth header present:', !!authHeader);
        
        if (!authHeader?.startsWith('Bearer ')) {
            // console.log('[Mobile Announcement Read] No Bearer token');
            return NextResponse.json(
                { error: 'Tidak terautentikasi' },
                { status: 401 }
            );
        }

        const token = authHeader.substring(7);
        // console.log('[Mobile Announcement Read] Token length:', token.length);

        const payload = await verifyMobileToken(token);
        // console.log('[Mobile Announcement Read] Payload:', payload ? 'valid' : 'invalid', payload?.sub);

        if (!payload?.sub) {
            // console.log('[Mobile Announcement Read] Invalid token payload');
            return NextResponse.json(
                { error: 'Token tidak valid' },
                { status: 401 }
            );
        }

        const userId = payload.sub;
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
