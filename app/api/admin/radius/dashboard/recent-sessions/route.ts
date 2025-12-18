/**
 * RADIUS Recent Sessions API
 * GET /api/admin/radius/dashboard/recent-sessions
 * 
 * Returns recent/active sessions with pagination
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authConfig } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { RadiusRepository } from '@/modules/network/repositories/RadiusRepository';

const radiusRepository = new RadiusRepository(prisma);

export async function GET(req: NextRequest) {
    try {
        // Auth check
        const session = await getServerSession(authConfig);
        if (!session?.user || false) {
            return NextResponse.json(
                { error: 'Unauthorized - Admin access required' },
                { status: 401 }
            );
        }

        const { searchParams } = new URL(req.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '50');
        const status = searchParams.get('status') || 'active'; // active | all

        const { sessions, total } = await radiusRepository.getRecentSessions({
            page,
            limit,
            status: status as 'active' | 'all',
        });

        return NextResponse.json({
            sessions,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        console.error('RADIUS recent sessions error:', error);
        return NextResponse.json(
            {
                error: 'Failed to fetch sessions',
                details: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}
