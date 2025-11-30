/**
 * RADIUS Single Customer Sync API
 * POST /api/admin/radius/sync/[id] - Sync specific customer
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authConfig } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { RadiusSyncService } from '@/lib/services/radius-sync-service';

export async function POST(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        // Auth check
        const session = await getServerSession(authConfig);
        if (!session?.user || session.user.role !== 'ADMIN') {
            return NextResponse.json(
                { error: 'Unauthorized - Admin access required' },
                { status: 401 }
            );
        }

        const { id } = params;
        const syncService = new RadiusSyncService(prisma);

        // Sync single customer
        await syncService.syncSingleCustomer(id);

        // Verify sync
        const verification = await syncService.verifyCustomerSync(id);

        return NextResponse.json({
            success: true,
            message: 'Customer synced to RADIUS',
            data: verification,
        });
    } catch (error) {
        console.error('RADIUS sync error:', error);
        return NextResponse.json(
            {
                error: 'Failed to sync customer',
                details: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}
