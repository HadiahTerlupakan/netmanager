/**
 * RADIUS Sync Status API
 * GET /api/admin/radius/dashboard/sync-status
 * 
 * Returns last sync status (placeholder for now)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authConfig } from '@/lib/auth';

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

        // TODO: Implement actual sync status tracking
        // For now, return placeholder data
        return NextResponse.json({
            lastSync: {
                time: new Date().toISOString(),
                success: true,
                stats: {
                    created: 0,
                    updated: 0,
                    deleted: 0,
                },
            },
            isRunning: false,
        });
    } catch (error) {
        console.error('RADIUS sync status error:', error);
        return NextResponse.json(
            {
                error: 'Failed to fetch sync status',
                details: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}
