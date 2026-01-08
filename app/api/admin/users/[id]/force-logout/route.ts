import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { hasPermission } from '@/lib/rbac';
import { socketEmitter } from '@/lib/websocket/emitter';

/**
 * POST /api/admin/users/[id]/force-logout
 * 
 * Force logout a user by incrementing their tokenVersion.
 * This invalidates all existing JWT tokens for the user.
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Permission check
        if (!await hasPermission('users:update')) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { id: targetUserId } = await params;
        const currentUser = session.user as any;

        // Prevent self force-logout
        if (currentUser.id === targetUserId) {
            return NextResponse.json({ error: 'Tidak dapat force logout diri sendiri' }, { status: 400 });
        }

        // Check if target user exists
        const targetUser = await prisma.user.findUnique({
            where: { id: targetUserId },
            select: { id: true, name: true, tokenVersion: true }
        });

        if (!targetUser) {
            return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 });
        }

        // Increment tokenVersion to invalidate all existing tokens
        const updatedUser = await prisma.user.update({
            where: { id: targetUserId },
            data: { tokenVersion: { increment: 1 } },
            select: { id: true, name: true, tokenVersion: true }
        });

        // Emit WebSocket event to force logout the user in real-time
        socketEmitter.forceLogout(targetUserId);

        console.log(`[FORCE_LOGOUT] User ${targetUser.name} (${targetUserId}) was force logged out by ${currentUser.name}. Token version: ${updatedUser.tokenVersion}`);

        return NextResponse.json({
            success: true,
            message: `User ${targetUser.name} berhasil di-logout paksa`,
            tokenVersion: updatedUser.tokenVersion
        });

    } catch (error: any) {
        console.error('[FORCE_LOGOUT] Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
