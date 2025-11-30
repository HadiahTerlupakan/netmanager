/**
 * RADIUS Sessions API
 * GET /api/admin/radius/sessions - List all active sessions
 * GET /api/admin/radius/sessions?username=xxx - Filter by username
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authConfig } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { RadiusRepository } from '@/lib/repositories/RadiusRepository';

export async function GET(req: NextRequest) {
    try {
        // Auth check
        const session = await getServerSession(authConfig);
        if (!session?.user || session.user.role !== 'ADMIN') {
            return NextResponse.json(
                { error: 'Unauthorized - Admin access required' },
                { status: 401 }
            );
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
