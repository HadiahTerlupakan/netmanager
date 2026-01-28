import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { hasPermission } from '@/lib/rbac';
import { socketEmitter } from '@/lib/websocket/emitter';
import { apiSuccess, ApiErrors, ErrorCodes, apiError } from '@/lib/api-response';

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
            return ApiErrors.unauthorized('Session tidak valid');
        }

        // Permission check
        if (!await hasPermission('users:update')) {
            return ApiErrors.forbidden('Anda tidak memiliki akses untuk force logout user');
        }

        const { id: targetUserId } = await params;
        const currentUser = session.user as any;

        // Prevent self force-logout
        if (currentUser.id === targetUserId) {
            return apiError('Tidak dapat force logout diri sendiri', ErrorCodes.VALIDATION_ERROR, { status: 400 });
        }

        // Check if target user exists
        const targetUser = await prisma.user.findUnique({
            where: { id: targetUserId },
            select: { id: true, name: true, tokenVersion: true }
        });

        if (!targetUser) {
            return ApiErrors.notFound('User');
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

        return apiSuccess({
            tokenVersion: updatedUser.tokenVersion
        }, { message: `User ${targetUser.name} berhasil di-logout paksa` });

    } catch (error: any) {
        console.error('[FORCE_LOGOUT] Error:', error);
        return ApiErrors.internalError('Gagal force logout user');
    }
}
