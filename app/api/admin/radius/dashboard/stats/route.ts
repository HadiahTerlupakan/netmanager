/**
 * RADIUS Dashboard Statistics API
 * GET /api/admin/radius/dashboard/stats
 * 
 * Returns overall statistics for the dashboard
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authConfig } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { RadiusRepository } from '@/modules/network/repositories/RadiusRepository';
import { hasPermission } from '@/lib/rbac';

const radiusRepository = new RadiusRepository(prisma);

export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authConfig);
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!await hasPermission('radius:read')) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const stats = await radiusRepository.getDashboardStats();
        return NextResponse.json(stats);
    } catch (error) {
        console.error('RADIUS dashboard stats error:', error);
        return NextResponse.json(
            {
                error: 'Failed to fetch dashboard statistics',
                details: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}
