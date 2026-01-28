/**
 * @swagger
 * /api/admin/radius/sessions:
 *   get:
 *     summary: Get RADIUS active sessions
 *     description: |
 *       Retrieve list of all active RADIUS sessions.
 *       Can filter by specific username.
 *       Requires admin access.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: username
 *         schema:
 *           type: string
 *         description: Filter sessions by username (optional)
 *     responses:
 *       200:
 *         description: Active sessions retrieved successfully
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-helpers';
import { prisma } from '@/lib/prisma';
import { RadiusRepository } from '@/modules/network/repositories/RadiusRepository';
import { hasPermission } from '@/lib/rbac';
import { apiSuccess, ApiErrors } from '@/lib/api-response';

export async function GET(req: NextRequest) {
    try {
        const session = await requireAdmin(req);
        if (session instanceof NextResponse) {
            return session;
        }

        if (!await hasPermission('radius:read')) {
            return ApiErrors.forbidden('Anda tidak memiliki akses untuk melihat sesi RADIUS');
        }

        const { searchParams } = new URL(req.url);
        const username = searchParams.get('username') || undefined;

        const radiusRepo = new RadiusRepository(prisma);
        const sessions = await radiusRepo.getActiveSessions(username);

        // Convert BigInt to string for JSON serialization
        const serializedSessions = sessions.map((session) => ({
            ...session,
            radAcctId: session.radAcctId.toString(),
            acctSessionTime: session.acctSessionTime?.toString() || null,
            acctInputOctets: session.acctInputOctets?.toString() || null,
            acctOutputOctets: session.acctOutputOctets?.toString() || null,
        }));

        return apiSuccess({
            count: sessions.length,
            sessions: serializedSessions,
        });
    } catch (error) {
        console.error('RADIUS sessions error:', error);
        return ApiErrors.internalError('Gagal mengambil sesi RADIUS');
    }
}
