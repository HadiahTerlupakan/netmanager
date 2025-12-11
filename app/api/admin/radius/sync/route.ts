/**
 * RADIUS Sync API
 * POST /api/admin/radius/sync - Sync all customers
 * POST /api/admin/radius/sync/[id] - Sync specific customer
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authConfig } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { RadiusSyncService } from '@/lib/services/radius-sync-service';

export async function POST(req: NextRequest) {
    try {
        // Auth check
        const session = await getServerSession(authConfig);
        if (!session?.user || false) {
            return NextResponse.json(
                { error: 'Unauthorized - Admin access required' },
                { status: 401 }
            );
        }

        const syncService = new RadiusSyncService(prisma);

        // Sync all active customers
        const result = await syncService.syncAllActiveCustomers();

        return NextResponse.json({
            success: true,
            message: 'RADIUS sync completed',
            stats: {
                created: result.created,
                updated: result.updated,
                deleted: result.deleted,
                total: result.created + result.updated + result.deleted,
            },
        });
    } catch (error) {
        console.error('RADIUS sync error:', error);
        return NextResponse.json(
            {
                error: 'Failed to sync RADIUS users',
                details: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}
