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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 count:
 *                   type: integer
 *                   description: Number of active sessions
 *                 sessions:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       radAcctId:
 *                         type: string
 *                         description: RADIUS accounting ID
 *                       userName:
 *                         type: string
 *                         description: Username
 *                       nasIpAddress:
 *                         type: string
 *                         description: NAS IP address
 *                       nasPortId:
 *                         type: string
 *                         description: NAS port ID
 *                       acctSessionId:
 *                         type: string
 *                         description: Session ID
 *                       acctSessionTime:
 *                         type: string
 *                         nullable: true
 *                         description: Session duration in seconds
 *                       acctInputOctets:
 *                         type: string
 *                         nullable: true
 *                         description: Input bytes
 *                       acctOutputOctets:
 *                         type: string
 *                         nullable: true
 *                         description: Output bytes
 *                       acctStartTime:
 *                         type: string
 *                         format: date-time
 *                         description: Session start time
 *                       callingStationId:
 *                         type: string
 *                         description: Calling station ID (MAC address)
 *                       framedIpAddress:
 *                         type: string
 *                         description: Assigned IP address
 *       401:
 *         description: Unauthorized - Admin access required
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Unauthorized - Admin access required"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Failed to fetch RADIUS sessions"
 *                 details:
 *                   type: string
 *                   description: Error details
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-helpers';
import { prisma } from '@/lib/prisma';
import { RadiusRepository } from '@/modules/network/repositories/RadiusRepository';
import { hasPermission } from '@/lib/rbac';

export async function GET(req: NextRequest) {
    try {
        const session = await requireAdmin(req);
        if (session instanceof NextResponse) {
            return session;
        }

        if (!await hasPermission('radius:read')) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
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

        return NextResponse.json({
            success: true,
            count: sessions.length,
            sessions: serializedSessions,
        });
    } catch (error) {
        console.error('RADIUS sessions error:', error);
        return NextResponse.json(
            {
                error: 'Failed to fetch RADIUS sessions',
                details: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}
